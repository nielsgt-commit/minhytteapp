ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_parent_maintenance_id_maintenance_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance" DROP COLUMN "is_pinned";--> statement-breakpoint
ALTER TABLE "maintenance" DROP COLUMN "procedure_position";--> statement-breakpoint
ALTER TABLE "maintenance" DROP COLUMN "parent_maintenance_id";