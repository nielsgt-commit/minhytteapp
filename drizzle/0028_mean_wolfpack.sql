ALTER TABLE "settlements" ADD COLUMN "phase" varchar(20) DEFAULT 'collecting_expenses' NOT NULL;
--> statement-breakpoint
UPDATE "settlements" SET "phase" = 'closed' WHERE "status" = 'closed';