ALTER TABLE "inspections" ALTER COLUMN "recurrence" SET DATA TYPE varchar(13);--> statement-breakpoint
-- Drop the retired "5year" cadence: fold existing rows into the legacy "yearly"
-- bucket (still readable, no longer offered) so they keep rendering a label.
UPDATE "inspections" SET "recurrence" = 'yearly' WHERE "recurrence" = '5year';--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "cadence_priority_group_id" integer;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_cadence_priority_group_id_user_groups_id_fk" FOREIGN KEY ("cadence_priority_group_id") REFERENCES "public"."user_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspection_cadence_group_shape" CHECK (("inspections"."recurrence" = 'priority_week') = ("inspections"."cadence_priority_group_id" IS NOT NULL));