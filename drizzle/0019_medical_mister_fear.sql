CREATE TABLE "parking_claims" (
	"property_id" integer NOT NULL,
	"slot_index" integer NOT NULL,
	"user_id" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parking_claims_property_id_slot_index_pk" PRIMARY KEY("property_id","slot_index"),
	CONSTRAINT "parking_slot_nonneg" CHECK ("parking_claims"."slot_index" >= 0)
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "parking_spots" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_claims" ADD CONSTRAINT "parking_claims_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_claims" ADD CONSTRAINT "parking_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "parking_spots_nonneg" CHECK ("properties"."parking_spots" >= 0);