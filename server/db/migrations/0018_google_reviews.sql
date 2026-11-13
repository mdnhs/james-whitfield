ALTER TABLE "testimonials" ALTER COLUMN "avatar_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "source" text DEFAULT 'site' NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "rating" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "review_url" text DEFAULT '' NOT NULL;