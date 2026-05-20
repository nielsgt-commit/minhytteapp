ALTER TABLE "allowed_emails" DROP CONSTRAINT "allowed_emails_email_unique";--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD COLUMN "property_id" integer;--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD COLUMN "user_group_id" integer;--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD COLUMN "ownership_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD COLUMN "used_at" timestamp;--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD COLUMN "used_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD CONSTRAINT "allowed_emails_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD CONSTRAINT "allowed_emails_user_group_id_user_groups_id_fk" FOREIGN KEY ("user_group_id") REFERENCES "public"."user_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD CONSTRAINT "allowed_emails_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;