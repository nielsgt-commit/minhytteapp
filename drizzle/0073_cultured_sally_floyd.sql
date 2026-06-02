ALTER TABLE "inspections" DROP CONSTRAINT "inspections_equipment_id_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_equipment_id_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;