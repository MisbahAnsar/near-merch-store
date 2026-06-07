import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import Plugin from '@/index';
import type { DatabaseType } from '@/db';
import * as schema from '@/db/schema';
import { config as loadEnv } from 'dotenv';
import pluginDevConfig from '../plugin.dev';
import { createPluginRuntime } from 'every-plugin';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadEnv({ path: join(__dirname, '../../.env') });

function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  const apiDatabaseUrl = process.env.API_DATABASE_URL;
  if (apiDatabaseUrl?.startsWith('postgres://') || apiDatabaseUrl?.startsWith('postgresql://')) {
    try {
      const derivedUrl = new URL(apiDatabaseUrl);
      derivedUrl.pathname = '/api_test';
      return derivedUrl.toString();
    } catch {
      // Fall back to the repo default below.
    }
  }

  return 'postgres://postgres:postgres@localhost:5433/api_test';
}

export const TEST_DB_URL = resolveTestDatabaseUrl();

if (
  !TEST_DB_URL.includes('localhost') &&
  !TEST_DB_URL.includes('127.0.0.1') &&
  !TEST_DB_URL.includes('_test') &&
  !TEST_DB_URL.includes('_test_db')
) {
  const masked = TEST_DB_URL.replace(/:\/\/.*@/, '://***@');
  throw new Error(
    `[Test Setup] SAFETY: Refusing to run tests against non-local database: ${masked}. ` +
    `Set TEST_DATABASE_URL to a local or test-specific database.`
  );
}

const TEST_CONFIG = {
  variables: pluginDevConfig.config.variables,
  secrets: {
    API_DATABASE_URL: TEST_DB_URL,
    PING_API_KEY: 'test_api_key',
    PING_WEBHOOK_SECRET: 'whsec_test_secret_key',
    // Printful v2 webhook secret is hex; tests compute HMAC over raw body.
    PRINTFUL_WEBHOOK_SECRET: 'a'.repeat(64),
  },
};

let _runtime: ReturnType<typeof createPluginRuntime> | null = null;
let _testDb: DatabaseType | null = null;
let _postgresClient: ReturnType<typeof pg> | null = null;
let _migrationsRun = false;

async function ensureTestDatabaseExists(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!databaseName) {
    throw new Error(`[Test Setup] Invalid database URL: ${databaseUrl}`);
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';

  const adminClient = pg(adminUrl.toString(), {
    max: 1,
    idle_timeout: 10 * 1000,
    connect_timeout: 10 * 1000,
  });

  try {
    const existing = await adminClient`
      SELECT 1
      FROM pg_database
      WHERE datname = ${databaseName}
    `;

    if (existing.length === 0) {
      const escapedName = databaseName.replace(/"/g, '""');
      await adminClient.unsafe(`CREATE DATABASE "${escapedName}"`);
      console.log(`[Test Setup] Created missing test database: ${databaseName}`);
    }
  } finally {
    await adminClient.end();
  }
}

export function getRuntime() {
  if (!_runtime) {
    _runtime = createPluginRuntime({
      registry: {
        [pluginDevConfig.pluginId]: {
          module: Plugin,
        },
      },
      secrets: {},
    });
  }
  return _runtime;
}

export function getTestDb(): DatabaseType {
  if (!_testDb) {
    if (!_postgresClient) {
      _postgresClient = pg(TEST_DB_URL, {
        max: 2,
        idle_timeout: 20 * 1000,
        connect_timeout: 10 * 1000,
      });
    }

    _testDb = drizzle({ client: _postgresClient, schema });
  }

  const db = _testDb;
  if (!db) {
    throw new Error('Database initialization failed');
  }
  return db;
}

export async function runMigrations() {
  if (_migrationsRun) {
    return;
  }

  await ensureTestDatabaseExists(TEST_DB_URL);

  const db = getTestDb();
  const migrationsFolder = join(__dirname, '../src/db/migrations');

  console.log(`[Test Setup] Running migrations from: ${migrationsFolder}`);
  console.log(`[Test Setup] Database URL: ${TEST_DB_URL}`);

  try {
    await migrate(db, { migrationsFolder });
    _migrationsRun = true;
    console.log('[Test Setup] Migrations completed successfully');
  } catch (error) {
    console.error('[Test Setup] Migration failed:', error);
    throw error;
  }
}

export async function getPluginClient(context?: { nearAccountId?: string; reqHeaders?: Headers; getRawBody?: () => Promise<string>; user?: { id: string; role?: string; email?: string; name?: string } | null }) {
  await runMigrations();

  const runtime = getRuntime();
  const { createClient } = await runtime.usePlugin(
    pluginDevConfig.pluginId,
    TEST_CONFIG
  );
  return createClient({ ...context, user: context?.user ?? null });
}

export async function teardown() {
  _testDb = null;

  if (_postgresClient) {
    await _postgresClient.end();
    _postgresClient = null;
  }

  if (_runtime) {
    await _runtime.shutdown();
    _runtime = null;
  }
  _migrationsRun = false;
}
