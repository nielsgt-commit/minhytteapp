CREATE TABLE "equipment_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"name" varchar(32) NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "equipment_categories" ADD CONSTRAINT "equipment_categories_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_categories_property_name_active" ON "equipment_categories" USING btree ("property_id","name") WHERE "equipment_categories"."archived_at" IS NULL;