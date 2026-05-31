CREATE INDEX "property_owners_user_id_idx" ON "property_owners" USING btree ("user_id") WHERE "property_owners"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "property_owners_user_group_id_idx" ON "property_owners" USING btree ("user_group_id") WHERE "property_owners"."user_group_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "allowed_emails_email_idx" ON "allowed_emails" USING btree ("email");--> statement-breakpoint
CREATE INDEX "allowed_emails_property_id_idx" ON "allowed_emails" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "allowed_emails_email_lower_idx" ON "allowed_emails" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "user_group_members_user_id_idx" ON "user_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_parent_user_id_idx" ON "users" USING btree ("parent_user_id");