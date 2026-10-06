import { eq } from 'drizzle-orm';
import { Context, Effect, Layer } from 'every-plugin/effect';
import * as schema from '../db/schema';
import { SiteSettingsSchema, type SiteSettings } from '../schema';
import { Database } from './database';

export const SITE_SETTINGS_ID = 'default';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  maintenance: { enabled: false },
};

export class SiteSettingsStore extends Context.Tag('SiteSettingsStore')<
  SiteSettingsStore,
  {
    readonly getSettings: () => Effect.Effect<SiteSettings, Error>;
    readonly setMaintenanceMode: (input: {
      enabled: boolean;
      message?: string;
    }) => Effect.Effect<SiteSettings, Error>;
  }
>() {}

function parseSettings(value: unknown): SiteSettings {
  const parsed = SiteSettingsSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  console.error(
    '[SiteSettingsStore] Invalid site settings payload, using fallback:',
    parsed.error.issues,
  );
  const enabled =
    typeof value === 'object' &&
    value !== null &&
    'maintenance' in value &&
    typeof (value as { maintenance?: { enabled?: unknown } }).maintenance?.enabled === 'boolean'
      ? Boolean((value as { maintenance: { enabled: boolean } }).maintenance.enabled)
      : false;

  return { maintenance: { enabled } };
}

function nextSettings(
  current: SiteSettings,
  input: { enabled: boolean; message?: string },
): SiteSettings {
  const maintenance: SiteSettings['maintenance'] = { enabled: input.enabled };

  if (input.message !== undefined) {
    const trimmed = input.message.trim();
    if (trimmed) {
      maintenance.message = trimmed;
    }
  } else if (current.maintenance.message) {
    maintenance.message = current.maintenance.message;
  }

  return { maintenance };
}

export const SiteSettingsStoreLive = Layer.effect(
  SiteSettingsStore,
  Effect.gen(function* () {
    const db = yield* Database;

    const getSettings = () =>
      Effect.tryPromise({
        try: async () => {
          try {
            const results = await db
              .select()
              .from(schema.siteSettings)
              .where(eq(schema.siteSettings.id, SITE_SETTINGS_ID))
              .limit(1);

            if (results.length === 0) {
              return DEFAULT_SITE_SETTINGS;
            }

            return parseSettings(results[0]!.settings);
          } catch (error) {
            console.error('[SiteSettingsStore] Failed to get site settings:', error);
            return DEFAULT_SITE_SETTINGS;
          }
        },
        catch: (error) => new Error(`Failed to get site settings: ${error}`),
      });

    return {
      getSettings,

      setMaintenanceMode: (input) =>
        Effect.gen(function* () {
          const current = yield* getSettings();
          const settings = nextSettings(current, input);
          const now = new Date();

          yield* Effect.tryPromise({
            try: async () => {
              await db
                .insert(schema.siteSettings)
                .values({
                  id: SITE_SETTINGS_ID,
                  settings,
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoUpdate({
                  target: schema.siteSettings.id,
                  set: {
                    settings,
                    updatedAt: now,
                  },
                });
            },
            catch: (error) => new Error(`Failed to set maintenance mode: ${error}`),
          });

          return settings;
        }),
    };
  }),
);
