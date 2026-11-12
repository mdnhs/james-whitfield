ALTER TABLE "pages" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_serviceId_unique" UNIQUE("service_id");