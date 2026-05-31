ALTER TABLE "user_group_members" ADD COLUMN "is_head" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user_group_members" m SET "is_head" = true
FROM "users" u, "user_groups" g
WHERE m."user_id" = u."id" AND u."is_head" = true
  AND m."user_group_id" = g."id" AND g."is_main" = true;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_head";