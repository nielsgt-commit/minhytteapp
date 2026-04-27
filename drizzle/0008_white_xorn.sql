ALTER TABLE "users" ADD COLUMN "oauth_sub" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_oauth_sub_unique" UNIQUE("oauth_sub");