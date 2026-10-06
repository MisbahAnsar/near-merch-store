import { eq, sql } from 'drizzle-orm';
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
  return parsed.success ? parsed.data : DEFAULT_SITE_SETTINGS;
}

export const SiteSettingsStoreLive = Layer.effect(
  SiteSettingsStore,
  Effect.gen(function* () {
    const db = yield* Database;

    const getSettings = () =>
      Effect.tryPromise({
        try: async () => {
          const results = await db
            .select()
            .from(schema.siteSettings)
            .where(eq(schema.siteSettings.id, SITE_SETTINGS_ID))
            .limit(1);

          if (results.length === 0) {
            return DEFAULT_SITE_SETTINGS;
          }

          return parseSettings(results[0]!.settings);
        },
        catch: (error) => new Error(`Failed to get site settings: ${error}`),
      });

    return {
      getSettings,

      // Single-statement upsert so concurrent admin toggles cannot lose writes:
      // enabled always comes from the input; an omitted message preserves the
      // stored one via fallback inside the SQL itself.
      setMaintenanceMode: (input) =>
        Effect.tryPromise({
          try: async () => {
            // Explicit message (including empty string) replaces the stored one;
            // undefined preserves it.
            const explicitMessageSql = sql`${
              input.message !== undefined ? input.message.trim() || null : null
            }::text`;
            const preservedMessageSql = sql`nullif(jsonb_extract_path_text(${schema.siteSettings.settings}, 'maintenance', 'message'), '')::text`;
            const messageSql =
              input.message !== undefined ? explicitMessageSql : preservedMessageSql;

            const rows = await db
              .insert(schema.siteSettings)
              .values({
                id: SITE_SETTINGS_ID,
                settings: sql`jsonb_strip_nulls(jsonb_build_object('maintenance', jsonb_build_object('enabled', ${input.enabled}::boolean, 'message', ${explicitMessageSql})))`,
                createdAt: new Date(),
              })
              .onConflictDoUpdate({
                target: schema.siteSettings.id,
                set: {
                  settings: sql`jsonb_strip_nulls(jsonb_build_object('maintenance', jsonb_build_object('enabled', ${input.enabled}::boolean, 'message', ${messageSql})))`,
                  updatedAt: new Date(),
                },
              })
              .returning({ settings: schema.siteSettings.settings });

            if (rows.length === 0) {
              throw new Error('Site settings upsert returned no rows');
            }

            return parseSettings(rows[0]!.settings);
          },
          catch: (error) => new Error(`Failed to set maintenance mode: ${error}`),
        }),
    };
  }),
);
