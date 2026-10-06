import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '@/db/schema';
import {
  clearOrders,
  clearProducts,
  createTestProduct,
  createTestProductVariant,
} from '../helpers';
import { getPluginClient, getTestDb, runMigrations, teardown } from '../setup';

const TEST_USER = 'maintenance-test.near';
const ADMIN_CONTEXT = {
  nearAccountId: 'admin.near',
  user: {
    id: 'admin-user',
    role: 'admin' as const,
    email: 'admin@nearmerch.com',
    name: 'Admin User',
  },
};

const shippingAddress = {
  firstName: 'Maintenance',
  lastName: 'Tester',
  email: 'maintenance@example.com',
  addressLine1: '123 Test Street',
  city: 'Los Angeles',
  state: 'CA',
  postCode: '90001',
  country: 'US',
};

describe('maintenance mode', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(schema.siteSettings);
    await clearOrders();
    await clearProducts();
  });

  it('returns maintenance disabled by default', async () => {
    const client = await getPluginClient();
    await expect(client.getSiteConfig()).resolves.toEqual({
      maintenance: { enabled: false },
    });
  });

  it('keeps maintenance enabled if stored settings fail schema validation', async () => {
    const db = getTestDb();
    await db.insert(schema.siteSettings).values({
      id: 'default',
      settings: { maintenance: { enabled: true, message: 123 } } as never,
    });

    const client = await getPluginClient();
    await expect(client.getSiteConfig()).resolves.toEqual({
      maintenance: { enabled: true },
    });
  });

  it('requires admin authentication to change maintenance mode', async () => {
    const client = await getPluginClient({ nearAccountId: TEST_USER });

    await expect(
      client.setMaintenanceMode({ enabled: true }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets an admin enable maintenance mode and blocks checkout', async () => {
    const adminClient = await getPluginClient(ADMIN_CONTEXT);
    const userClient = await getPluginClient({ nearAccountId: TEST_USER });

    await expect(
      adminClient.setMaintenanceMode({
        enabled: true,
        message: 'Store closed for updates',
      }),
    ).resolves.toEqual({
      maintenance: {
        enabled: true,
        message: 'Store closed for updates',
      },
    });

    await expect(userClient.getSiteConfig()).resolves.toEqual({
      maintenance: {
        enabled: true,
        message: 'Store closed for updates',
      },
    });

    await createTestProduct('maintenance-product', { fulfillmentProvider: 'manual' });
    await createTestProductVariant('maintenance-variant', 'maintenance-product');

    await expect(
      userClient.createCheckout({
        items: [{ productId: 'maintenance-product', variantId: 'maintenance-variant', quantity: 1 }],
        shippingAddress,
        selectedRates: {},
        shippingCost: 0,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        paymentProvider: 'pingpay',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Store closed for updates',
    });
  });

  it('allows checkout after an admin disables maintenance mode', async () => {
    const adminClient = await getPluginClient(ADMIN_CONTEXT);
    const userClient = await getPluginClient({ nearAccountId: TEST_USER });

    await adminClient.setMaintenanceMode({ enabled: true });
    await adminClient.setMaintenanceMode({ enabled: false });

    await createTestProduct('maintenance-open-product', { fulfillmentProvider: 'manual' });
    await createTestProductVariant(
      'maintenance-open-unavailable',
      'maintenance-open-product',
      { inStock: false },
    );

    await expect(
      userClient.createCheckout({
        items: [
          {
            productId: 'maintenance-open-product',
            variantId: 'maintenance-open-unavailable',
            quantity: 1,
          },
        ],
        shippingAddress,
        selectedRates: {},
        shippingCost: 0,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        paymentProvider: 'pingpay',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Variant is unavailable: maintenance-open-unavailable',
    });
  });
});
