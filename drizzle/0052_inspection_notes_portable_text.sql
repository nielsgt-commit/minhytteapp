ALTER TABLE "inspections" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "notes_pt" jsonb;
