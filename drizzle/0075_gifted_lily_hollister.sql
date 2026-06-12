CREATE TABLE "child_parents" (
	"child_user_id" integer NOT NULL,
	"parent_user_id" integer NOT NULL,
	CONSTRAINT "child_parents_child_user_id_parent_user_id_pk" PRIMARY KEY("child_user_id","parent_user_id")
);
--> statement-breakpoint
ALTER TABLE "child_parents" ADD CONSTRAINT "child_parents_child_user_id_users_id_fk" FOREIGN KEY ("child_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_parents" ADD CONSTRAINT "child_parents_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "child_parents_parent_user_id_idx" ON "child_parents" USING btree ("parent_user_id");--> statement-breakpoint
INSERT INTO "child_parents" ("child_user_id", "parent_user_id")
SELECT "id", "parent_user_id" FROM "users" WHERE "parent_user_id" IS NOT NULL
ON CONFLICT DO NOTHING;