ALTER TABLE "maintenance" ADD COLUMN "due_kind" varchar(13) DEFAULT 'not_decided' NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance" ADD COLUMN "due_priority_group_id" integer;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_due_priority_group_id_user_groups_id_fk" FOREIGN KEY ("due_priority_group_id") REFERENCES "public"."user_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "maintenance" SET "due_kind" = 'date' WHERE "due_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_due_shape" CHECK ((
        ("maintenance"."due_kind" = 'date' AND "maintenance"."due_at" IS NOT NULL AND "maintenance"."due_priority_group_id" IS NULL)
        OR ("maintenance"."due_kind" = 'priority_week' AND "maintenance"."due_priority_group_id" IS NOT NULL AND "maintenance"."due_at" IS NULL)
        OR ("maintenance"."due_kind" IN ('not_decided', 'dugnad', 'opening', 'closing') AND "maintenance"."due_at" IS NULL AND "maintenance"."due_priority_group_id" IS NULL)
      ));