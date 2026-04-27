ALTER TABLE "booking_occupants" ADD COLUMN "room_id" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "status" varchar(9) DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "notes" varchar(1024);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by_id" integer;--> statement-breakpoint
ALTER TABLE "booking_occupants" ADD CONSTRAINT "booking_occupants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "booking_cancelled_has_timestamp" CHECK (("bookings"."status" = 'cancelled') = ("bookings"."cancelled_at" IS NOT NULL));