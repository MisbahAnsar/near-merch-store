import { Context, Effect, Layer } from 'every-plugin/effect';
import { EmailService } from './email';

const VANGUARD_CONTRACT_ID = 'vanguard.nearlegion.near';
const MAINNET_RPC_URL = 'https://rpc.mainnet.near.org';
const CACHE_TTL_MS = 60_000;

const vanguardSbtCache = new Map<string, { isHolder: boolean; expiresAt: number }>();

class MerchBoxError extends Error {
  override readonly name = 'MerchBoxError';
}

async function viewNear(
  nodeUrl: string,
  contractId: string,
  methodName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(nodeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'near-merch-store',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'optimistic',
        account_id: contractId,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`NEAR RPC request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: { result?: number[] };
  };

  if (payload.error) {
    throw new Error(payload.error.message || 'NEAR RPC request failed');
  }

  const rawResult = payload.result?.result;
  if (!Array.isArray(rawResult)) {
    return null;
  }

  const text = Buffer.from(rawResult).toString('utf8');
  return text ? JSON.parse(text) : null;
}

async function checkVanguardSbt(nodeUrl: string, accountId: string): Promise<boolean> {
  try {
    const supply = await viewNear(nodeUrl, VANGUARD_CONTRACT_ID, 'nft_supply_for_owner', {
      account_id: accountId,
    });

    if (BigInt(String(supply ?? 0)) > 0n) {
      return true;
    }
  } catch {
    try {
      const tokens = await viewNear(nodeUrl, VANGUARD_CONTRACT_ID, 'nft_tokens_for_owner', {
        account_id: accountId,
        from_index: '0',
        limit: 1,
      });

      if (Array.isArray(tokens) && tokens.length > 0) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

export class MerchBoxService extends Context.Tag('MerchBoxService')<
  MerchBoxService,
  {
    readonly checkSbt: (params: {
      nearAccountId: string;
    }) => Effect.Effect<{ isHolder: boolean }>;
    readonly submitRequest: (params: {
      nearAccountId: string;
      orderDetails: string;
    }) => Effect.Effect<{ success: true }, Error>;
  }
>() {}

export interface MerchBoxServiceConfig {
  fromEmail: string;
}

export const MerchBoxServiceLive = (config: MerchBoxServiceConfig) =>
  Layer.effect(
    MerchBoxService,
    Effect.gen(function* () {
      const emailService = yield* EmailService;
      const nodeUrl = MAINNET_RPC_URL;

      return {
        checkSbt: ({ nearAccountId }) =>
          Effect.gen(function* () {
            const now = Date.now();
            const normalizedAccountId = nearAccountId.trim().toLowerCase();
            const cached = vanguardSbtCache.get(normalizedAccountId);

            if (cached && cached.expiresAt > now) {
              return { isHolder: cached.isHolder };
            }

            const isHolder = yield* Effect.promise(() =>
              checkVanguardSbt(nodeUrl, normalizedAccountId),
            ).pipe(Effect.catchAll(() => Effect.succeed(false)));

            vanguardSbtCache.set(normalizedAccountId, {
              isHolder,
              expiresAt: now + CACHE_TTL_MS,
            });

            return { isHolder };
          }),
        submitRequest: ({ nearAccountId, orderDetails }) =>
          Effect.gen(function* () {
            const normalizedAccountId = nearAccountId.trim().toLowerCase();
            const cached = vanguardSbtCache.get(normalizedAccountId);
            const now = Date.now();

            let isHolder: boolean;

            if (cached && cached.expiresAt > now) {
              isHolder = cached.isHolder;
            } else {
              isHolder = yield* Effect.promise(() =>
                checkVanguardSbt(nodeUrl, normalizedAccountId),
              ).pipe(Effect.catchAll(() => Effect.succeed(false)));

              vanguardSbtCache.set(normalizedAccountId, {
                isHolder,
                expiresAt: now + CACHE_TTL_MS,
              });
            }

            if (!isHolder) {
              yield* Effect.fail(
                new MerchBoxError(
                  'Vanguard SBT not found. You need a Vanguard SBT to request a merch box.',
                ),
              );
            }

            yield* emailService.sendNotification({
              to: ['merch@near.foundation'],
              subject: `Merch Box Request from ${nearAccountId}`,
              body: `A merch box request has been submitted.\n\nNEAR Account: ${nearAccountId}\n\nOrder Details:\n${orderDetails}`,
              replyTo: `${nearAccountId}@near.email`,
            });

            return { success: true as const };
          }),
      };
    }),
  );
