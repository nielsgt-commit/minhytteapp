CREATE TABLE "procedure_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"structure_id" integer,
	"infrastructure_id" integer,
	"equipment_id" integer,
	"description" varchar(255) NOT NULL,
	"instructions_pt" jsonb,
	"position" integer,
	"added_by" integer NOT NULL,
	"created_in_inspection_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "procedure_step_location_xor" CHECK ((
        (CASE WHEN "procedure_steps"."structure_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "procedure_steps"."infrastructure_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "procedure_steps"."equipment_id" IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "maintenance" ADD COLUMN "source_step_id" integer;--> statement-breakpoint
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_infrastructure_id_infrastructure_id_fk" FOREIGN KEY ("infrastructure_id") REFERENCES "public"."infrastructure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_created_in_inspection_id_inspections_id_fk" FOREIGN KEY ("created_in_inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_source_step_id_procedure_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."procedure_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Data backfill: extract pinned maintenance rows into procedure_steps, rewrite
-- followups (parent_maintenance_id) to source_step_id, then drop the old rows.
-- A temp column carries the old maintenance id so children can be remapped.
ALTER TABLE "procedure_steps" ADD COLUMN "legacy_maintenance_id" integer;--> statement-breakpoint
INSERT INTO "procedure_steps" (
	"structure_id", "infrastructure_id", "equipment_id", "description",
	"instructions_pt", "position", "added_by", "created_in_inspection_id",
	"created_at", "legacy_maintenance_id"
)
SELECT
	"structure_id", "infrastructure_id", "equipment_id", "description",
	"instructions_pt", "procedure_position", "added_by", "inspection_id",
	"created_at", "id"
FROM "maintenance"
WHERE "is_pinned" = true;--> statement-breakpoint
UPDATE "maintenance" m
SET "source_step_id" = ps."id"
FROM "procedure_steps" ps
WHERE ps."legacy_maintenance_id" = m."parent_maintenance_id";--> statement-breakpoint
DELETE FROM "maintenance" WHERE "is_pinned" = true;--> statement-breakpoint
ALTER TABLE "procedure_steps" DROP COLUMN "legacy_maintenance_id";