CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"destination" text NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"article_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_sourcePath_unique" UNIQUE("source_path"),
	CONSTRAINT "redirects_status_code_check" CHECK ("redirects"."status_code" in (301, 302, 307, 308)),
	CONSTRAINT "redirects_not_self_check" CHECK ("redirects"."source_path" <> "redirects"."destination")
);
--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "cover_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "scheduled_by" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_requested_by" uuid;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_scheduled_by_users_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_review_requested_by_users_id_fk" FOREIGN KEY ("review_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_one_featured_idx" ON "articles" USING btree ("featured") WHERE featured = true;--> statement-breakpoint
CREATE INDEX "articles_scheduled_idx" ON "articles" USING btree ("scheduled_for") WHERE status = 'scheduled';