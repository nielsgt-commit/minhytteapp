CREATE TABLE "property_seasons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "property_seasons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"property_id" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"start_month" integer NOT NULL,
	"start_day" integer NOT NULL,
	"end_month" integer NOT NULL,
	"end_day" integer NOT NULL,
	"priority_weeks" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "property_seasons_start_month_range" CHECK ("property_seasons"."start_month" BETWEEN 1 AND 12),
	CONSTRAINT "property_seasons_end_month_range" CHECK ("property_seasons"."end_month" BETWEEN 1 AND 12),
	CONSTRAINT "property_seasons_start_day_range" CHECK ("property_seasons"."start_day" BETWEEN 1 AND 31),
	CONSTRAINT "property_seasons_end_day_range" CHECK ("property_seasons"."end_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
ALTER TABLE "property_priority_weeks" DROP CONSTRAINT "priority_week_peak_only";--> statement-breakpoint
DROP INDEX "priority_week_uq_group_year";--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ADD COLUMN "season_id" integer;--> statement-breakpoint
ALTER TABLE "property_seasons" ADD CONSTRAINT "property_seasons_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_seasons_property_name_active" ON "property_seasons" USING btree ("property_id","name") WHERE "property_seasons"."archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ADD CONSTRAINT "property_priority_weeks_season_id_property_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."property_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ADD CONSTRAINT "priority_week_uq_group_year_season" UNIQUE NULLS NOT DISTINCT("user_group_id","year","season_id");--> statement-breakpoint
ALTER TABLE "property_priority_weeks" ADD CONSTRAINT "priority_week_valid" CHECK ("property_priority_weeks"."iso_week" BETWEEN 1 AND 53);