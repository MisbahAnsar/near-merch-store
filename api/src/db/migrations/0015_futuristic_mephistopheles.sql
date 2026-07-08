CREATE TABLE "merch_box_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"near_account_id" text NOT NULL,
	"items" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE INDEX "merch_box_requests_account_idx" ON "merch_box_requests" USING btree ("near_account_id");--> statement-breakpoint
CREATE INDEX "merch_box_requests_created_idx" ON "merch_box_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "merch_box_requests_reviewed_idx" ON "merch_box_requests" USING btree ("reviewed");