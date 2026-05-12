CREATE TABLE "property_split_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"config" jsonb NOT NULL,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "property_split_policies_property_id_name_unique" UNIQUE("property_id","name")
);
--> statement-breakpoint
ALTER TABLE "property_split_policies" ADD CONSTRAINT "property_split_policies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_split_policies" ADD CONSTRAINT "property_split_policies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;