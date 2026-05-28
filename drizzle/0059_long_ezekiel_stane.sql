ALTER TABLE "user_groups" ADD COLUMN "property_id" integer;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "user_groups" g
SET property_id = sub.pid
FROM (
  SELECT user_group_id, MAX(property_id) AS pid, COUNT(DISTINCT property_id) AS n
  FROM property_owners
  WHERE user_group_id IS NOT NULL
  GROUP BY user_group_id
) sub
WHERE g.id = sub.user_group_id AND sub.n = 1;