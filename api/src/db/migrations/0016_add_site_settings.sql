CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "site_settings" ("id", "settings")
VALUES ('default', '{"maintenance":{"enabled":false}}'::jsonb);
