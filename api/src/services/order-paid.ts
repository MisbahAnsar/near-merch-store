import { Effect, Schedule } from 'every-plugin/effect';
import type { MarketplaceRuntime } from '../runtime';
import type { OrderWithItems, OrderStatus, ProviderConfig } from '../schema';
import { EmailService } from './email';
import { OrderStore, ProviderConfigStore } from '../store';
import { resolveNotificationEmails } from '../utils/near-account';

interface HandleOrderPaidResult {
  allProviderConfirmationsSucceeded: boolean;
  confirmationResults: Record<string, { success: boolean; error?: string }>;
}

export function handleOrderPaidEffect(options: {
  runtime: MarketplaceRuntime;
  order: OrderWithItems;
}): Effect.Effect<HandleOrderPaidResult, Error, OrderStore | ProviderConfigStore | EmailService> {
  const { runtime, order } = options;

  return Effect.gen(function* () {
    const orderStore = yield* OrderStore;
    const providerConfigStore = yield* ProviderConfigStore;
    const emailService = yield* EmailService;

    const confirmationResults: Record<string, { success: boolean; error?: string }> = {};
    const draftOrderIds = order.draftOrderIds || {};

    for (const [providerName, draftId] of Object.entries(draftOrderIds)) {
      if (providerName === 'manual') {
        confirmationResults[providerName] = { success: true };
        continue;
      }

      const provider = runtime.getProvider(providerName);
      if (!provider) {
        confirmationResults[providerName] = { success: false, error: 'Provider not configured' };
        continue;
      }

      const confirmEffect = Effect.tryPromise({
        try: () => provider.client.confirmOrder({ id: draftId as string }),
        catch: (error: unknown) => {
          const errorMsg = `Failed to confirm order at ${providerName}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[handleOrderPaid] ${errorMsg}`, { providerName, draftId });
          return new Error(errorMsg);
        },
      }).pipe(Effect.retry({ times: 3, schedule: Schedule.exponential('100 millis') }));

      const result = yield* confirmEffect.pipe(
        Effect.map(() => ({ success: true } as const)),
        Effect.catchAll((error: unknown) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[handleOrderPaid] Order confirmation failed`, { providerName, draftId, error: errorMsg });
          return Effect.succeed({ success: false as const, error: errorMsg });
        }),
      );

      confirmationResults[providerName] = result;
    }

    const hasManualItems = (order.items ?? []).some(
      (item) => item.fulfillmentProvider === 'manual',
    );

    if (hasManualItems) {
      try {
        const manualConfig = yield* providerConfigStore.getConfig('manual');

        if (!manualConfig?.enabled) {
          const allSuccess = Object.values(confirmationResults).every((r) => r.success);

          return {
            allProviderConfirmationsSucceeded: allSuccess,
            confirmationResults,
          };
        }

        const settings = manualConfig?.settings as Record<string, unknown> | undefined;
        const globalEmails: string[] = Array.isArray(settings?.notificationEmails) ? (settings!.notificationEmails as string[]) : [];
        const globalOwnerIds: string[] = Array.isArray(settings?.ownerAccountIds) ? (settings!.ownerAccountIds as string[]) : [];
        const replyTo: string | undefined = typeof settings?.replyToEmail === 'string' ? settings.replyToEmail : undefined;
        const fromEmail = runtime.fulfillmentConfig.manual?.fromEmail ?? 'orders@nearmerch.com';

        const productEmailEntries = (order.items ?? [])
          .filter((item) => item.fulfillmentProvider === 'manual')
          .map((item) => {
            const fulfillmentConfig = item.fulfillmentConfig as Record<string, unknown> | undefined;
            const providerConfig = fulfillmentConfig?.providerConfig as Record<string, unknown> | undefined;
            const manualDetails = providerConfig?.manualNotification as Record<string, unknown> | undefined;
            return {
              notificationEmails: Array.isArray(manualDetails?.notificationEmails) ? (manualDetails!.notificationEmails as string[]) : [],
              ownerAccountIds: Array.isArray(manualDetails?.ownerAccountIds) ? (manualDetails!.ownerAccountIds as string[]) : [],
            };
          });

        const notificationEmails = resolveNotificationEmails(
          globalEmails,
          globalOwnerIds,
          productEmailEntries,
        );

        if (notificationEmails.length > 0) {
          const itemSummary = (order.items ?? [])
            .map((item) => `- ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} x${item.quantity}`)
            .join('\n');

          const shippingInfo = order.shippingAddress
            ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}\n${order.shippingAddress.addressLine1}\n${order.shippingAddress.city}, ${order.shippingAddress.state || ''} ${order.shippingAddress.postCode}\n${order.shippingAddress.country}\n${order.shippingAddress.email}`
            : 'No shipping address';

          yield* emailService.sendNotification({
            to: notificationEmails,
            subject: `New order received: ${order.id}`,
            body: `A new order has been placed and paid.\n\nOrder ID: ${order.id}\nTotal: ${order.currency.toUpperCase()} ${order.totalAmount.toFixed(2)}\n\nItems:\n${itemSummary}\n\nShipping:\n${shippingInfo}`,
            replyTo,
          });
        }
      } catch (emailError) {
        console.error('[handleOrderPaid] Failed to send manual notification email:', emailError);
      }
    }

    const allSuccess = Object.values(confirmationResults).every((r) => r.success);

    return {
      allProviderConfirmationsSucceeded: allSuccess,
      confirmationResults,
    };
  });
}
