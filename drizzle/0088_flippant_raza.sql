CREATE TABLE "shopping_item_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_item_assignees" ADD CONSTRAINT "shopping_item_assignees_item_id_shopping_list_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shopping_list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item_assignees" ADD CONSTRAINT "shopping_item_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_item_assignee_uq" ON "shopping_item_assignees" USING btree ("item_id","user_id");