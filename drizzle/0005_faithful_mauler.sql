ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_recurrence_interval_pairing";--> statement-breakpoint
ALTER TABLE "maintenance" ALTER COLUMN "category" SET DATA TYPE varchar(11);--> statement-breakpoint
ALTER TABLE "maintenance" ALTER COLUMN "recurrence" SET DATA TYPE varchar(6);--> statement-breakpoint
ALTER TABLE "maintenance" DROP COLUMN "recurrence_interval_days";