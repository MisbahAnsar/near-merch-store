import { eq, desc, and, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'every-plugin/effect';
import * as schema from '../db/schema';
import { Database } from './database';

type MerchBoxItem = { article: string; qty: number; cost: number };

export interface MerchBoxRequestRow {
  id: string;
  nearAccountId: string;
  items: MerchBoxItem[];
  notes: string | null;
  createdAt: string;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export class MerchBoxStore extends Context.Tag('MerchBoxStore')<
  MerchBoxStore,
  {
    readonly create: (request: {
      nearAccountId: string;
      items: MerchBoxItem[];
      notes: string | null;
    }) => Effect.Effect<void, Error>;
    readonly findAll: (options: {
      limit: number;
      offset: number;
      reviewed?: boolean;
    }) => Effect.Effect<{ requests: MerchBoxRequestRow[]; total: number }, Error>;
    readonly markReviewed: (id: string, reviewedBy: string) => Effect.Effect<void, Error>;
  }
>() {}

function toDate(value: Date | string | null): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString();
}

export const MerchBoxStoreLive = Layer.effect(
  MerchBoxStore,
  Effect.gen(function* () {
    const db = yield* Database;

    const rowToRequest = (row: typeof schema.merchBoxRequests.$inferSelect): MerchBoxRequestRow => ({
      id: row.id,
      nearAccountId: row.nearAccountId,
      items: row.items as MerchBoxItem[],
      notes: row.notes,
      createdAt: toDate(row.createdAt) ?? new Date().toISOString(),
      reviewed: row.reviewed,
      reviewedAt: toDate(row.reviewedAt),
      reviewedBy: row.reviewedBy,
    });

    return {
      create: ({ nearAccountId, items, notes }) =>
        Effect.tryPromise({
          try: async () => {
            await db.insert(schema.merchBoxRequests).values({
              id: crypto.randomUUID(),
              nearAccountId,
              items,
              notes,
              createdAt: new Date(),
              reviewed: false,
            });
          },
          catch: (error) => new Error(`Failed to create merch box request: ${error}`),
        }),

      findAll: ({ limit, offset, reviewed }) =>
        Effect.tryPromise({
          try: async () => {
            const conditions: ReturnType<typeof eq>[] = [];
            if (reviewed !== undefined) {
              conditions.push(eq(schema.merchBoxRequests.reviewed, reviewed));
            }
            const where = conditions.length > 0 ? and(...conditions) : undefined;

            const rows = await db
              .select()
              .from(schema.merchBoxRequests)
              .where(where)
              .orderBy(desc(schema.merchBoxRequests.createdAt))
              .limit(limit)
              .offset(offset);

            const countResult = await db
              .select({ count: sql<number>`count(*)` })
              .from(schema.merchBoxRequests)
              .where(where);

            return {
              requests: rows.map(rowToRequest),
              total: Number(countResult[0]?.count ?? 0),
            };
          },
          catch: (error) => new Error(`Failed to find merch box requests: ${error}`),
        }),

      markReviewed: (id, reviewedBy) =>
        Effect.tryPromise({
          try: async () => {
            await db
              .update(schema.merchBoxRequests)
              .set({ reviewed: true, reviewedAt: new Date(), reviewedBy })
              .where(eq(schema.merchBoxRequests.id, id));
          },
          catch: (error) => new Error(`Failed to mark merch box request as reviewed: ${error}`),
        }),
    };
  }),
);
