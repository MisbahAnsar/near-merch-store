import * as schema from '@/db/schema';
import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearOrders, createTestOrder } from '../helpers';
import { getPluginClient, getTestDb, runMigrations, teardown } from '../setup';

const TEST_MANUAL_WEBHOOK_SECRET = 'manual_whsec_test_secret';

const findOrder = (orderId: string) =>
  getTestDb().query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
  });

const signBody = (body: string) =>
  `sha256=${createHmac('sha256', TEST_MANUAL_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')}`;

describe('Manual webhook authorization', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await clearOrders();
  });

  it('rejects an anonymous unsigned status update and leaves the order unchanged', async () => {
    const orderId = 'manual-auth-anonymous';
    const payload = { orderId, status: 'delivered' as const };
    await createTestOrder(orderId);
    const client = await getPluginClient();

    await expect(client.manualWebhook(payload)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect((await findOrder(orderId))?.status).toBe('pending');
  });

  it('rejects an authenticated customer without a signature', async () => {
    const orderId = 'manual-auth-customer';
    const payload = { orderId, status: 'cancelled' as const };
    await createTestOrder(orderId, { userId: 'security-victim.near' });
    const client = await getPluginClient({
      nearAccountId: 'security-victim.near',
      user: { id: 'security-victim-user', role: 'user' },
    });

    await expect(client.manualWebhook(payload)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect((await findOrder(orderId))?.status).toBe('pending');
  });

  it('rejects an invalid signature and leaves the order unchanged', async () => {
    const orderId = 'manual-auth-invalid-signature';
    const payload = { orderId, status: 'refunded' as const };
    const rawBody = JSON.stringify(payload);
    await createTestOrder(orderId);
    const headers = new Headers({
      'x-manual-signature': `sha256=${'0'.repeat(64)}`,
    });
    const client = await getPluginClient({
      reqHeaders: headers,
      getRawBody: async () => rawBody,
    });

    await expect(client.manualWebhook(payload)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect((await findOrder(orderId))?.status).toBe('pending');
  });

  it('rejects a valid signature when the request body was changed', async () => {
    const orderId = 'manual-auth-tampered-body';
    const originalBody = JSON.stringify({ orderId, status: 'delivered' });
    const payload = { orderId, status: 'refunded' as const };
    const tamperedBody = JSON.stringify(payload);
    await createTestOrder(orderId);
    const headers = new Headers({
      'x-manual-signature': signBody(originalBody),
    });
    const client = await getPluginClient({
      reqHeaders: headers,
      getRawBody: async () => tamperedBody,
    });

    await expect(client.manualWebhook(payload)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect((await findOrder(orderId))?.status).toBe('pending');
  });

  it('accepts a correctly signed webhook and updates the order', async () => {
    const orderId = 'manual-auth-valid-signature';
    const payload = { orderId, status: 'delivered' as const };
    const rawBody = JSON.stringify(payload);
    await createTestOrder(orderId);
    const headers = new Headers({
      'x-manual-signature': signBody(rawBody),
    });
    const client = await getPluginClient({
      reqHeaders: headers,
      getRawBody: async () => rawBody,
    });

    await expect(client.manualWebhook(payload)).resolves.toEqual({
      received: true,
    });
    expect((await findOrder(orderId))?.status).toBe('delivered');
  });

  it('accepts an authenticated admin without a signature', async () => {
    const orderId = 'manual-auth-admin';
    const payload = { orderId, status: 'refunded' as const };
    await createTestOrder(orderId);
    const client = await getPluginClient({
      nearAccountId: 'ballzz.near',
      user: { id: 'ballzz-admin-user', role: 'admin' },
    });

    await expect(client.manualWebhook(payload)).resolves.toEqual({
      received: true,
    });
    expect((await findOrder(orderId))?.status).toBe('refunded');
  });
});
