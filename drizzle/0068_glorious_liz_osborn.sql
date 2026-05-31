ALTER TABLE "property_priority_weeks" ADD COLUMN "user_group_id" integer;--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ADD CONSTRAINT "property_priority_weeks_user_group_id_user_groups_id_fk" FOREIGN KEY ("user_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- backfill: priority weeks whose owner row is a USER-owner -> that user's is_main family group for the property
UPDATE "property_priority_weeks" pw SET "user_group_id" = (
  SELECT g.id FROM "property_owners" po
  JOIN "user_group_members" m ON m.user_id = po.user_id
  JOIN "user_groups" g ON g.id = m.user_group_id
  WHERE po.id = pw.property_owner_id AND g.is_main = true AND g.property_id = pw.property_id
  LIMIT 1
) WHERE pw.user_group_id IS NULL;--> statement-breakpoint
-- backfill: priority weeks whose owner row is already a GROUP-owner row
UPDATE "property_priority_weeks" pw SET "user_group_id" =
  (SELECT po.user_group_id FROM "property_owners" po WHERE po.id = pw.property_owner_id)
WHERE pw.user_group_id IS NULL;