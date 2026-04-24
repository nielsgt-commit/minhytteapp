ALTER TABLE "property_owners" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "property_owners" CASCADE;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "owner_group_id" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "link" varchar(255);--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_group_id_user_groups_id_fk" FOREIGN KEY ("owner_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;