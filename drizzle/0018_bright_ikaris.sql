CREATE TABLE "stays" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stay_date_order" CHECK ("stays"."end_date" IS NULL OR "stays"."start_date" <= "stays"."end_date")
);
--> statement-breakpoint
ALTER TABLE "stays" ADD CONSTRAINT "stays_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stays" ADD CONSTRAINT "stays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stay_open_per_user_property_uq" ON "stays" USING btree ("user_id","property_id") WHERE "stays"."end_date" IS NULL;