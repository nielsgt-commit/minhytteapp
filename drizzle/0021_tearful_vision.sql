CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expense_types_valid";--> statement-breakpoint
INSERT INTO "expense_categories" ("name") VALUES
  ('food'), ('gas'), ('maintenance'), ('capex'), ('opex'), ('fixed')
ON CONFLICT ("name") DO NOTHING;