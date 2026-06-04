import { Effect, Schedule } from 'every-plugin/effect';
import type { MarketplaceRuntime, PaymentProvider } from '../../../runtime';
import type { OrderStatus } from '../../../schema';
import { OrderStore } from '../../../store/orders';
import { ProviderConfigStore } from '../../../store/providers';
import { EmailService } from '../../../services/email';
import { handleOrderPaidEffect } from '../../../services/order-paid';

export function handlePingPayWebhookEffect(options: {
  runtime: MarketplaceRuntime;
  pingProvider: PaymentProvider;
  signature: string;
  timestamp: string;
  body: string;
}): Effect.Effect<{ received: true }, Error, OrderStore | ProviderConfigStore | EmailService> {
  const { runtime, pingProvider, signature, timestamp, body } = options;

  return Effect.gen(function* () {
    const webhookResult = yield* Effect.tryPromise({
      try: async () =>
        pingProvider.client.verifyWebhook({
          body,
          signature,
          timestamp,
        }),
      catch: (error) => {
        const errorMsg = `Webhook verification failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[PingPay Webhook]', errorMsg, { error: String(error) });
        return new Error(errorMsg);
      },
    });

    console.log('[PingPay Webhook] Webhook verified successfully', {
      eventType: webhookResult.eventType,
      orderId: webhookResult.orderId,
      sessionId: webhookResult.sessionId,
    });

    const eventType = webhookResult.eventType;
    const { orderId, sessionId } = webhookResult;

    const store = yield* OrderStore;

    console.log('[PingPay Webhook] Looking up order', { orderId, sessionId });

    let order = orderId ? yield* store.find(orderId) : null;
    if (!order && sessionId) {
      console.log('[PingPay Webhook] Order not found by ID, trying session lookup', { sessionId });
      order = yield* store.findByCheckoutSession(sessionId);
    }

    if (!order) {
      console.warn('[PingPay Webhook] Order not found, skipping processing', { orderId, sessionId });
      return { received: true } as const;
    }

    console.log('[PingPay Webhook] Order found', {
      orderId: order.id,
      currentStatus: order.status,
      eventType,
    });

    switch (eventType) {
      case 'payment.success':
      case 'checkout.session.completed': {
        console.log('[PingPay Webhook] Processing payment success event', {
          currentStatus: order.status,
        });

        if (order.status !== 'draft_created' && order.status !== 'pending' && order.status !== 'payment_pending') {
          console.log('[PingPay Webhook] Order already processed, skipping', {
            orderId: order.id,
            currentStatus: order.status,
          });
          return { received: true } as const;
        }

        yield* store.updateStatus(
          resolvedOrderId(order.id),
          'paid',
          'service:pingpay',
          eventType,
          { sessionId },
        );
        console.log('[PingPay Webhook] Updated order status to paid', { orderId: order.id });

        const paidResult = yield* handleOrderPaidEffect({ runtime, order });

        const finalStatus: OrderStatus = paidResult.allProviderConfirmationsSucceeded
          ? 'processing'
          : 'paid_pending_fulfillment';

        yield* store.updateStatus(
          resolvedOrderId(order.id),
          finalStatus,
          'service:pingpay',
          `fulfillment:${paidResult.allProviderConfirmationsSucceeded ? 'confirmed' : 'partial'}`,
          { confirmationResults: paidResult.confirmationResults, allSuccess: paidResult.allProviderConfirmationsSucceeded },
        );
        console.log('[PingPay Webhook] Updated final status', { orderId: order.id, finalStatus, allSuccess: paidResult.allProviderConfirmationsSucceeded });
        break;
      }

      case 'payment.failed':
        console.log('[PingPay Webhook] Processing payment failed event', { orderId: resolvedOrderId(order.id) });
        yield* store.updateStatus(
          resolvedOrderId(order.id),
          'payment_failed',
          'service:pingpay',
          eventType,
          { sessionId },
        );
        console.log('[PingPay Webhook] Updated order status to payment_failed', { orderId: resolvedOrderId(order.id) });
        break;

      default:
        console.warn('[PingPay Webhook] Unknown event type', { eventType });
        break;
    }

    console.log('[PingPay Webhook] Processing completed successfully', { orderId: resolvedOrderId(order.id) });
    return { received: true } as const;
  });
}

function resolvedOrderId(orderId: string): string {
  return orderId;
}