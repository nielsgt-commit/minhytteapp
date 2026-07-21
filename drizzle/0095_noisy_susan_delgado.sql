ALTER TABLE "inventory_items" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;