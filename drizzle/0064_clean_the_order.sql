ALTER TABLE "users" ALTER COLUMN "is_child" SET DEFAULT false;--> statement-breakpoint
UPDATE "users" SET "is_child" = false WHERE "is_child" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "is_child" SET NOT NULL;