CREATE TABLE "settlement_acceptances" (
	"settlement_id" integer NOT NULL,
	"head_user_id" integer NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_acceptances_settlement_id_head_user_id_pk" PRIMARY KEY("settlement_id","head_user_id")
);
--> statement-breakpoint
ALTER TABLE "settlement_acceptances" ADD CONSTRAINT "settlement_acceptances_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_acceptances" ADD CONSTRAINT "settlement_acceptances_head_user_id_users_id_fk" FOREIGN KEY ("head_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;