CREATE TABLE "manual_fulfillments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notification_emails" jsonb DEFAULT '[]'::jsonb,
	"assigned_user_id" text,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"rejection_reason" text,
	"internal_notes" text,
	"tracking_code" text,
	"tracking_url" text,
	"carrier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_configs" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "manual_fulfillments" ADD CONSTRAINT "manual_fulfillments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_fulfillments_order_idx" ON "manual_fulfillments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "manual_fulfillments_status_idx" ON "manual_fulfillments" USING btree ("status");