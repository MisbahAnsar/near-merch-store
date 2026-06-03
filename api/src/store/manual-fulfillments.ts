import { eq, and, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'every-plugin/effect';
import * as crypto from 'crypto';
import * as schema from '../db/schema';
import type { ManualFulfillmentStatus } from '../schema';
import { Database } from './database';

export interface ManualFulfillment {
  id: string;
  orderId: string;
  status: ManualFulfillmentStatus;
  notificationEmails: string[];
  assignedUserId: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  fulfilledAt: string | null;
  shippedAt: string | null;
  rejectionReason: string | null;
  internalNotes: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ManualFulfillmentStore extends Context.Tag('ManualFulfillmentStore')<
  ManualFulfillmentStore,
  {
    readonly getByOrderId: (orderId: string) => Effect.Effect<ManualFulfillment | null, Error>;
    readonly getById: (id: string) => Effect.Effect<ManualFulfillment | null, Error>;
    readonly create: (input: {
      orderId: string;
      notificationEmails?: string[];
      assignedUserId?: string;
    }) => Effect.Effect<ManualFulfillment, Error>;
    readonly updateStatus: (id: string, status: ManualFulfillmentStatus, extras?: {
      rejectionReason?: string;
      internalNotes?: string;
      trackingCode?: string;
      trackingUrl?: string;
      carrier?: string;
    }) => Effect.Effect<ManualFulfillment, Error>;
    readonly getQueue: (input: {
      status?: ManualFulfillmentStatus;
      limit?: number;
      offset?: number;
    }) => Effect.Effect<{ fulfillments: ManualFulfillment[]; total: number }, Error>;
    readonly addNote: (id: string, note: string) => Effect.Effect<ManualFulfillment, Error>;
  }
>() {}

type ManualFulfillmentRow = typeof schema.manualFulfillments.$inferSelect;

const rowToFulfillment = (row: ManualFulfillmentRow): ManualFulfillment => ({
  id: row.id,
  orderId: row.orderId,
  status: row.status as ManualFulfillmentStatus,
  notificationEmails: row.notificationEmails ?? [],
  assignedUserId: row.assignedUserId ?? null,
  acceptedAt: row.acceptedAt?.toISOString() ?? null,
  rejectedAt: row.rejectedAt?.toISOString() ?? null,
  fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
  shippedAt: row.shippedAt?.toISOString() ?? null,
  rejectionReason: row.rejectionReason ?? null,
  internalNotes: row.internalNotes ?? null,
  trackingCode: row.trackingCode ?? null,
  trackingUrl: row.trackingUrl ?? null,
  carrier: row.carrier ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const ManualFulfillmentStoreLive = Layer.effect(
  ManualFulfillmentStore,
  Effect.gen(function* () {
    const db = yield* Database;

    return {
      getByOrderId: (orderId) =>
        Effect.tryPromise({
          try: async () => {
            const results = await db
              .select()
              .from(schema.manualFulfillments)
              .where(eq(schema.manualFulfillments.orderId, orderId))
              .limit(1);

            if (results.length === 0) return null;
            return rowToFulfillment(results[0]!);
          },
          catch: (error) => new Error(`Failed to get manual fulfillment by orderId: ${error}`),
        }),

      getById: (id) =>
        Effect.tryPromise({
          try: async () => {
            const results = await db
              .select()
              .from(schema.manualFulfillments)
              .where(eq(schema.manualFulfillments.id, id))
              .limit(1);

            if (results.length === 0) return null;
            return rowToFulfillment(results[0]!);
          },
          catch: (error) => new Error(`Failed to get manual fulfillment: ${error}`),
        }),

      create: (input) =>
        Effect.tryPromise({
          try: async () => {
            const id = crypto.randomUUID();
            const now = new Date();
            await db.insert(schema.manualFulfillments).values({
              id,
              orderId: input.orderId,
              status: 'pending',
              notificationEmails: input.notificationEmails ?? [],
              assignedUserId: input.assignedUserId ?? null,
              createdAt: now,
              updatedAt: now,
            });

            const results = await db
              .select()
              .from(schema.manualFulfillments)
              .where(eq(schema.manualFulfillments.id, id))
              .limit(1);

            return rowToFulfillment(results[0]!);
          },
          catch: (error) => new Error(`Failed to create manual fulfillment: ${error}`),
        }),

      updateStatus: (id, status, extras) =>
        Effect.tryPromise({
          try: async () => {
            const now = new Date();
            const updateData: Partial<typeof schema.manualFulfillments.$inferInsert> = {
              status,
              updatedAt: now,
            };

            if (status === 'accepted') updateData.acceptedAt = now;
            if (status === 'rejected') {
              updateData.rejectedAt = now;
              if (extras?.rejectionReason) updateData.rejectionReason = extras.rejectionReason;
            }
            if (status === 'processing') updateData.fulfilledAt = now;
            if (status === 'shipped') {
              updateData.shippedAt = now;
              if (extras?.trackingCode) updateData.trackingCode = extras.trackingCode;
              if (extras?.trackingUrl) updateData.trackingUrl = extras.trackingUrl;
              if (extras?.carrier) updateData.carrier = extras.carrier;
            }

            if (extras?.internalNotes) updateData.internalNotes = extras.internalNotes;

            await db
              .update(schema.manualFulfillments)
              .set(updateData)
              .where(eq(schema.manualFulfillments.id, id));

            const results = await db
              .select()
              .from(schema.manualFulfillments)
              .where(eq(schema.manualFulfillments.id, id))
              .limit(1);

            return rowToFulfillment(results[0]!);
          },
          catch: (error) => new Error(`Failed to update manual fulfillment: ${error}`),
        }),

      getQueue: (input) =>
        Effect.tryPromise({
          try: async () => {
            const statusCondition = input.status
              ? eq(schema.manualFulfillments.status, input.status)
              : undefined;

            const countQuery = db
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.manualFulfillments);

            const dataQuery = db
              .select()
              .from(schema.manualFulfillments)
              .orderBy(schema.manualFulfillments.createdAt)
              .limit(input.limit ?? 50)
              .offset(input.offset ?? 0);

            if (statusCondition) {
              countQuery.where(statusCondition);
              dataQuery.where(statusCondition);
            }

            const countResult = await countQuery;
            const total = countResult[0]?.count ?? 0;

            const results = await dataQuery;

            return {
              fulfillments: results.map(rowToFulfillment),
              total,
            };
          },
          catch: (error) => new Error(`Failed to get manual fulfillment queue: ${error}`),
        }),

      addNote: (id, note) =>
        Effect.tryPromise({
          try: async () => {
            const existing = await db
              .select()
              .from(schema.manualFulfillments)
              .where(eq(schema.manualFulfillments.id, id))
              .limit(1);

            if (existing.length === 0) {
              throw new Error('Manual fulfillment not found');
            }

            const currentNotes = existing[0]!.internalNotes ?? '';
            const updatedNotes = currentNotes
              ? `${currentNotes}\n[${new Date().toISOString()}] ${note}`
              : `[${new Date().toISOString()}] ${note}`;

            await db
              .update(schema.manualFulfillments)
              .set({
                internalNotes: updatedNotes,
                updatedAt: new Date(),
              })
              .where(eq(schema.manualFulfillments.id, id));

            const results = await db
              .select()
              .from(schema.manualFulfillments)
              .where(eq(schema.manualFulfillments.id, id))
              .limit(1);

            return rowToFulfillment(results[0]!);
          },
          catch: (error) => new Error(`Failed to add note to manual fulfillment: ${error}`),
        }),
    };
  }),
);