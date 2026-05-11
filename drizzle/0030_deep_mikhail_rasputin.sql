CREATE TABLE "settlement_booking_adjustments" (
	"settlement_id" integer NOT NULL,
	"booking_id" integer NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"extra_names" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "settlement_booking_adjustments_settlement_id_booking_id_pk" PRIMARY KEY("settlement_id","booking_id")
);
--> statement-breakpoint
ALTER TABLE "settlement_booking_adjustments" ADD CONSTRAINT "settlement_booking_adjustments_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_booking_adjustments" ADD CONSTRAINT "settlement_booking_adjustments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;