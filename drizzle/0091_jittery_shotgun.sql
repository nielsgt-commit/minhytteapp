ALTER TABLE "images" DROP CONSTRAINT "images_target_xor";--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "infrastructure_id" integer;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_infrastructure_id_infrastructure_id_fk" FOREIGN KEY ("infrastructure_id") REFERENCES "public"."infrastructure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "images_infrastructure_cover_uq" ON "images" USING btree ("infrastructure_id") WHERE "images"."infrastructure_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_target_xor" CHECK ((
        (CASE WHEN "images"."structure_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "images"."infrastructure_id" IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN "images"."equipment_id" IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1);