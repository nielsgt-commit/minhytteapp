ALTER TABLE "booking_rooms" ADD COLUMN "beds_kid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_rooms" ADD COLUMN "travel_cot" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "beds_kid" integer DEFAULT 0 NOT NULL;