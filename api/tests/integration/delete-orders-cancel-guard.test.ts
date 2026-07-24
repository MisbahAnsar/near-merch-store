import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { getPluginClient, getTestDb, runMigrations, teardown } from '../setup';
import { clearOrders, createTestOrder } from '../helpers';

const ADMIN_CONTEXT = {
  nearAccountId: 'admin.near',
  user: {
    id: 'admin-user',
    role: 'admin' as const,
    email: 'admin@nearmerch.com',
    name: 'Admin User',
  },
};

describe('deleteOrders provider cancel guard', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await clearOrders();
  });

  it('soft-deletes paid orders without requiring provider cancel', async () => {
    const orderId = 'delete-guard-paid-001';
    await createTestOrder(orderId, {
      status: 'paid',
      draftOrderIds: { printful: '999999991' },
    });

    const adminClient = await getPluginClient(ADMIN_CONTEXT);
    const result = await adminClient.deleteOrders({ orderIds: [orderId] });

    expect(result.deleted).toBe(1);
    expect(result.errors).toEqual([]);

    const db = getTestDb();
    const [row] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);

    expect(row?.isDeleted).toBe(true);
    expect(row?.status).toBe('paid');
  });

  it('soft-deletes processing orders without requiring provider cancel', async () => {
    const orderId = 'delete-guard-processing-001';
    await createTestOrder(orderId, {
      status: 'processing',
      draftOrderIds: { printful: '999999993' },
    });

    const adminClient = await getPluginClient(ADMIN_CONTEXT);
    const result = await adminClient.deleteOrders({ orderIds: [orderId] });

    expect(result.deleted).toBe(1);
    expect(result.errors).toEqual([]);

    const db = getTestDb();
    const [row] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);

    expect(row?.isDeleted).toBe(true);
    expect(row?.status).toBe('processing');
  });

  it('does not delete abandoned drafts when provider is unavailable', async () => {
    const orderId = 'delete-guard-draft-001';
    await createTestOrder(orderId, {
      status: 'draft_created',
      draftOrderIds: { printful: '999999992' },
    });

    const adminClient = await getPluginClient(ADMIN_CONTEXT);
    const result = await adminClient.deleteOrders({ orderIds: [orderId] });

    expect(result.deleted).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);

    const db = getTestDb();
    const [row] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);

    expect(row?.isDeleted).toBe(false);
    expect(row?.status).toBe('draft_created');
  });
});
