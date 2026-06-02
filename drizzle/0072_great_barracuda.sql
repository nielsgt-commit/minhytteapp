ALTER TABLE "inspections" DROP CONSTRAINT "inspections_structure_id_structures_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_infrastructure_id_infrastructure_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_structure_id_structures_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_infrastructure_id_infrastructure_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_parent_maintenance_id_maintenance_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance" DROP CONSTRAINT "maintenance_inspection_id_inspections_id_fk";
--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_structure_id_structures_id_fk";
--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_infrastructure_id_infrastructure_id_fk" FOREIGN KEY ("infrastructure_id") REFERENCES "public"."infrastructure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_infrastructure_id_infrastructure_id_fk" FOREIGN KEY ("infrastructure_id") REFERENCES "public"."infrastructure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_parent_maintenance_id_maintenance_id_fk" FOREIGN KEY ("parent_maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE cascade ON UPDATE no action;