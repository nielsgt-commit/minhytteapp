ALTER TABLE "expense_categories" DROP CONSTRAINT "expense_categories_name_unique";--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_name_active" ON "expense_categories" USING btree ("name") WHERE "expense_categories"."archived_at" IS NULL;