ALTER TABLE "users" ADD COLUMN "onboarding_step" varchar(16);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_dismissed_at" timestamp;--> statement-breakpoint
UPDATE "users" SET "onboarding_step" = 'done';