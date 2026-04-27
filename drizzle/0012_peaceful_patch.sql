CREATE TABLE "property_priority_weeks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "property_priority_weeks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"property_id" integer NOT NULL,
	"property_owner_id" integer NOT NULL,
	"year" integer NOT NULL,
	"iso_week" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "priority_week_peak_only" CHECK ("property_priority_weeks"."iso_week" IN (28, 29, 30))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_head" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ADD CONSTRAINT "property_priority_weeks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ADD CONSTRAINT "property_priority_weeks_property_owner_id_property_owners_id_fk" FOREIGN KEY ("property_owner_id") REFERENCES "public"."property_owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "priority_week_uq_owner_year" ON "property_priority_weeks" USING btree ("property_owner_id","year");