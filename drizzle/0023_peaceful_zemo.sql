ALTER TABLE "settlements" DROP CONSTRAINT "settlements_year_season_unique";--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "property_id" integer;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "property_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_property_id_year_season_unique" UNIQUE("property_id","year","season");