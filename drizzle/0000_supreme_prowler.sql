CREATE TABLE "booking_occupants" (
	"booking_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "booking_occupants_booking_id_user_id_pk" PRIMARY KEY("booking_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "booking_rooms" (
	"booking_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"beds_sm" integer DEFAULT 0 NOT NULL,
	"beds_lg" integer DEFAULT 0 NOT NULL,
	"beds_double" integer DEFAULT 0 NOT NULL,
	"mattresses" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "booking_rooms_booking_id_room_id_pk" PRIMARY KEY("booking_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"booker_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	CONSTRAINT "booking_date_order" CHECK ("bookings"."start_date" <= "bookings"."end_date")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"timestamp" varchar(255) NOT NULL,
	"authors" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_id" integer NOT NULL,
	"uploaded_by" integer NOT NULL,
	"url" text NOT NULL,
	"caption" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" varchar(255) NOT NULL,
	"summary" varchar(255),
	"added_by" integer NOT NULL,
	"assigned_to_id" integer,
	"building_id" integer,
	"place_id" integer,
	"category" varchar(10) NOT NULL,
	"severity" varchar(5) NOT NULL,
	"status" varchar(5) NOT NULL,
	"recurrence" varchar(9) NOT NULL,
	"recurrence_interval_days" integer,
	"routine_id" integer,
	"routine_position" integer,
	"due_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "maintenance_location_xor" CHECK (("maintenance"."building_id" IS NOT NULL) <> ("maintenance"."place_id" IS NOT NULL)),
	CONSTRAINT "maintenance_done_has_timestamp" CHECK (("maintenance"."status" = 'done') = ("maintenance"."completed_at" IS NOT NULL)),
	CONSTRAINT "maintenance_routine_position_pairing" CHECK (("maintenance"."routine_id" IS NULL) = ("maintenance"."routine_position" IS NULL)),
	CONSTRAINT "maintenance_recurrence_interval_pairing" CHECK (("maintenance"."recurrence" = 'recurring') = ("maintenance"."recurrence_interval_days" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "maintenance_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "building_adjacencies" (
	"building_a" integer NOT NULL,
	"building_b" integer NOT NULL,
	CONSTRAINT "building_adjacencies_building_a_building_b_pk" PRIMARY KEY("building_a","building_b"),
	CONSTRAINT "building_adj_order" CHECK ("building_adjacencies"."building_a" < "building_adjacencies"."building_b")
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "buildings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL,
	"property_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "places_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"property_id" integer
);
--> statement-breakpoint
CREATE TABLE "property_owners" (
	"property_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"ownership_pct" numeric(5, 2) NOT NULL,
	CONSTRAINT "property_owners_property_id_user_id_pk" PRIMARY KEY("property_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "properties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_adjacencies" (
	"room_a" integer NOT NULL,
	"room_b" integer NOT NULL,
	CONSTRAINT "room_adjacencies_room_a_room_b_pk" PRIMARY KEY("room_a","room_b"),
	CONSTRAINT "room_adj_order" CHECK ("room_adjacencies"."room_a" < "room_adjacencies"."room_b")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"building_id" integer NOT NULL,
	"beds_sm" integer DEFAULT 0 NOT NULL,
	"beds_lg" integer DEFAULT 0 NOT NULL,
	"beds_double" integer DEFAULT 0 NOT NULL,
	"mattresses" integer DEFAULT 0 NOT NULL,
	"room_type" varchar(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"expense_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"share_amount" integer NOT NULL,
	CONSTRAINT "shares_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"payer_id" integer NOT NULL,
	"reimbursed_by_id" integer,
	"booking_id" integer,
	"maintenance_id" integer,
	"settlement_id" integer,
	"timestamp" varchar(255) NOT NULL,
	"status" varchar(11) NOT NULL,
	CONSTRAINT "expense_reimbursed_has_reimburser" CHECK ("expenses"."status" <> 'reimbursed' OR "expenses"."reimbursed_by_id" IS NOT NULL),
	CONSTRAINT "expense_reimburser_not_payer" CHECK ("expenses"."reimbursed_by_id" <> "expenses"."payer_id")
);
--> statement-breakpoint
CREATE TABLE "settlement_family_totals" (
	"settlement_id" integer NOT NULL,
	"family_id" integer NOT NULL,
	"total_paid" integer NOT NULL,
	"total_share" integer NOT NULL,
	"net" integer NOT NULL,
	CONSTRAINT "settlement_family_totals_settlement_id_family_id_pk" PRIMARY KEY("settlement_id","family_id")
);
--> statement-breakpoint
CREATE TABLE "settlement_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_id" integer NOT NULL,
	"from_family_id" integer NOT NULL,
	"to_family_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(7) NOT NULL,
	"paid_at" timestamp,
	CONSTRAINT "transfer_distinct_parties" CHECK ("settlement_transfers"."from_family_id" <> "settlement_transfers"."to_family_id"),
	CONSTRAINT "transfer_amount_positive" CHECK ("settlement_transfers"."amount" > 0),
	CONSTRAINT "transfer_paid_has_timestamp" CHECK (("settlement_transfers"."status" = 'paid') = ("settlement_transfers"."paid_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"season" varchar(6),
	"status" varchar(6) NOT NULL,
	"split_policy" varchar(15) NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "settlements_year_season_unique" UNIQUE("year","season"),
	CONSTRAINT "settlement_closed_has_timestamp" CHECK (("settlements"."status" = 'closed') = ("settlements"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "families_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "family_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"family_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"relationship_type" varchar(6) NOT NULL,
	CONSTRAINT "family_members_family_id_user_id_unique" UNIQUE("family_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "relationships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_1" integer NOT NULL,
	"person_2" integer NOT NULL,
	"relationship_type" varchar(255) NOT NULL,
	"start_date" varchar(255) NOT NULL,
	"end_date" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"date_of_birth" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "booking_occupants" ADD CONSTRAINT "booking_occupants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupants" ADD CONSTRAINT "booking_occupants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_rooms" ADD CONSTRAINT "booking_rooms_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_rooms" ADD CONSTRAINT "booking_rooms_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booker_id_users_id_fk" FOREIGN KEY ("booker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_updates" ADD CONSTRAINT "maintenance_updates_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_updates" ADD CONSTRAINT "maintenance_updates_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_adjacencies" ADD CONSTRAINT "building_adjacencies_building_a_buildings_id_fk" FOREIGN KEY ("building_a") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_adjacencies" ADD CONSTRAINT "building_adjacencies_building_b_buildings_id_fk" FOREIGN KEY ("building_b") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_adjacencies" ADD CONSTRAINT "room_adjacencies_room_a_rooms_id_fk" FOREIGN KEY ("room_a") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_adjacencies" ADD CONSTRAINT "room_adjacencies_room_b_rooms_id_fk" FOREIGN KEY ("room_b") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reimbursed_by_id_users_id_fk" FOREIGN KEY ("reimbursed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_family_totals" ADD CONSTRAINT "settlement_family_totals_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_family_totals" ADD CONSTRAINT "settlement_family_totals_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_from_family_id_families_id_fk" FOREIGN KEY ("from_family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_to_family_id_families_id_fk" FOREIGN KEY ("to_family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_1_users_id_fk" FOREIGN KEY ("person_1") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_2_users_id_fk" FOREIGN KEY ("person_2") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;