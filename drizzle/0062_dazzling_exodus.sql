CREATE TABLE "settlement_reviews" (
	"settlement_id" integer NOT NULL,
	"head_user_id" integer NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_reviews_settlement_id_head_user_id_pk" PRIMARY KEY("settlement_id","head_user_id")
);
--> statement-breakpoint
ALTER TABLE "settlement_reviews" ADD CONSTRAINT "settlement_reviews_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_reviews" ADD CONSTRAINT "settlement_reviews_head_user_id_users_id_fk" FOREIGN KEY ("head_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "settlement_progress";