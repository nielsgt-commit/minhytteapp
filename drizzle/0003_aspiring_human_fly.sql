CREATE TABLE "property_owners" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "property_owners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"property_id" integer NOT NULL,
	"user_id" integer,
	"user_group_id" integer,
	"ownership_pct" numeric(5, 2) NOT NULL,
	CONSTRAINT "property_owners_exactly_one_ref" CHECK (("property_owners"."user_id" IS NULL) <> ("property_owners"."user_group_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "user_group_members" (
	"user_group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "user_group_members_user_group_id_user_id_pk" PRIMARY KEY("user_group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "properties" DROP CONSTRAINT "properties_owner_group_id_user_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_user_group_id_user_groups_id_fk" FOREIGN KEY ("user_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_group_id_user_groups_id_fk" FOREIGN KEY ("user_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_owners_user_uq" ON "property_owners" USING btree ("property_id","user_id") WHERE "property_owners"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "property_owners_group_uq" ON "property_owners" USING btree ("property_id","user_group_id") WHERE "property_owners"."user_group_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "owner_group_id";