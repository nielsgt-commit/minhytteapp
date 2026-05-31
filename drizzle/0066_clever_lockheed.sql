ALTER TABLE "expense_categories" ADD COLUMN "property_id" integer;--> statement-breakpoint
-- fresh start: archive legacy global categories and assign them to the lowest property id to satisfy NOT NULL
UPDATE "expense_categories" SET "archived_at" = now() WHERE "archived_at" IS NULL;--> statement-breakpoint
UPDATE "expense_categories" SET "property_id" = (SELECT MIN("id") FROM "properties") WHERE "property_id" IS NULL;--> statement-breakpoint
ALTER TABLE "expense_categories" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "expense_categories_name_active";--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_property_name_active" ON "expense_categories" USING btree ("property_id","name") WHERE "expense_categories"."archived_at" IS NULL;
