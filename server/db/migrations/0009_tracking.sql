CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_id" uuid NOT NULL,
	"analytics" boolean NOT NULL,
	"marketing" boolean NOT NULL,
	"revision" integer NOT NULL,
	"banner_hash" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_events_action_check" CHECK ("consent_events"."action" in ('accept','reject','custom','withdraw'))
);
--> statement-breakpoint
CREATE INDEX "consent_events_consent_idx" ON "consent_events" USING btree ("consent_id","created_at");