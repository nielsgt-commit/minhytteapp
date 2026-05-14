CREATE TABLE "inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer,
	"place_id" integer,
	"equipment_id" integer,
	"started_by_user_id" integer NOT NULL,
	"inspected_by" varchar(255) NOT NULL,
	"recurrence" varchar(6) NOT NULL,
	"notes" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "inspection_target_exclusive" CHECK ((
        (CASE WHEN "inspections"."building_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "inspections"."place_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "inspections"."equipment_id" IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "maintenance" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance" ADD COLUMN "parent_maintenance_id" integer;--> statement-breakpoint
ALTER TABLE "maintenance" ADD COLUMN "inspection_id" integer;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_started_by_user_id_users_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_parent_maintenance_id_maintenance_id_fk" FOREIGN KEY ("parent_maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;