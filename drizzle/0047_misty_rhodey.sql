ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_location_xor";--> statement-breakpoint
UPDATE "maintenance" SET "structure_id" = NULL WHERE "equipment_id" IS NOT NULL AND "structure_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment" DROP CONSTRAINT "equipment_structure_id_structures_id_fk";
--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "structure_id";--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_location_xor" CHECK ((
        (CASE WHEN "maintenance"."structure_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "maintenance"."infrastructure_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "maintenance"."equipment_id" IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1);