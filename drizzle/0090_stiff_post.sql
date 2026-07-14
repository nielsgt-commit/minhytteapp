CREATE TABLE "images" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"property_id" integer NOT NULL,
	"structure_id" integer,
	"equipment_id" integer,
	"data" "bytea" NOT NULL,
	"mime_type" varchar(32) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "images_target_xor" CHECK ((
        (CASE WHEN "images"."structure_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "images"."equipment_id" IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "images_structure_cover_uq" ON "images" USING btree ("structure_id") WHERE "images"."structure_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "images_equipment_cover_uq" ON "images" USING btree ("equipment_id") WHERE "images"."equipment_id" IS NOT NULL;