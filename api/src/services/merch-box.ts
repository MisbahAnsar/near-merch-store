import { Context, Effect, Layer } from 'every-plugin/effect';
import { MerchBoxStore, type MerchBoxRequestRow } from '../store/merch-box';

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
    readonly checkSbt: (params: { nearAccountId: string }) => Effect.Effect<{ isHolder: boolean }>;
    readonly submitRequest: (params: {
      nearAccountId: string;
      items: Array<{ article: string; qty: number; cost: number }>;
      notes: string | null;
    }) => Effect.Effect<{ success: true }, Error>;
    readonly getRequests: (params: {
      limit: number;
      offset: number;
      reviewed?: boolean;
    }) => Effect.Effect<{ requests: MerchBoxRequestRow[]; total: number }, Error>;
    readonly markReviewed: (params: { id: string; reviewedBy: string }) => Effect.Effect<void, Error>;
  }
>() {}

export const MerchBoxServiceLive = Layer.effect(
  MerchBoxService,
  Effect.gen(function* () {
    const store = yield* MerchBoxStore;
    const nodeUrl = MAINNET_RPC_URL;

    function resolveSbt(normalizedAccountId: string): Effect.Effect<boolean, never> {
      const now = Date.now();
      const cached = vanguardSbtCache.get(normalizedAccountId);
      if (cached && cached.expiresAt > now) {
        return Effect.succeed(cached.isHolder);
      }
      return Effect.promise(() =>
        checkVanguardSbt(nodeUrl, normalizedAccountId).then((result) => {
          vanguardSbtCache.set(normalizedAccountId, {
            isHolder: result,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          return result;
        }),
      ).pipe(Effect.catchAll(() => Effect.succeed(false)));
    }

    return {
      checkSbt: ({ nearAccountId }) =>
        Effect.gen(function* () {
          const isHolder = yield* resolveSbt(nearAccountId.trim().toLowerCase());
          return { isHolder };
        }),

      submitRequest: ({ nearAccountId, items, notes }) =>
        Effect.gen(function* () {
          const isHolder = yield* resolveSbt(nearAccountId.trim().toLowerCase());

          if (!isHolder) {
            yield* Effect.fail(
              new MerchBoxError(
                'Vanguard SBT not found. You need a Vanguard SBT to request a merch box.',
              ),
            );
          }

          yield* store.create({ nearAccountId, items, notes });
          return { success: true as const };
        }),

      getRequests: ({ limit, offset, reviewed }) =>
        Effect.gen(function* () {
          return yield* store.findAll({ limit, offset, reviewed });
        }),

      markReviewed: ({ id, reviewedBy }) =>
        Effect.gen(function* () {
          yield* store.markReviewed(id, reviewedBy);
        }),
    };
  }),
);
