import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import { propertyTable } from "./property.schema.ts"

export const usersTable = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  email_verified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  is_admin: boolean("is_admin").notNull().default(false),
  is_head: boolean("is_head").notNull().default(false),
  is_child: boolean("is_child"),
  parent_user_id: integer("parent_user_id").references(
    (): AnyPgColumn => usersTable.id,
  ),
  settlement_progress: varchar("settlement_progress", {
    length: 11,
    enum: ["in_progress", "all_done"],
  })
    .notNull()
    .default("in_progress"),
  birthday: date("birthday", { mode: "string" }),
  onboarding_step: varchar("onboarding_step", {
    length: 16,
    enum: [
      "user",
      "basics",
      "buildings",
      "rooms",
      "infrastructure",
      "equipment",
      "done",
    ],
  }),
  onboarding_dismissed_at: timestamp("onboarding_dismissed_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
})

export const userGroupsTable = pgTable("user_groups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  is_main: boolean("is_main").notNull().default(false),
  property_id: integer("property_id").references(
    (): AnyPgColumn => propertyTable.id,
  ),
})

export const userGroupMembersTable = pgTable(
  "user_group_members",
  {
    user_group_id: integer("user_group_id")
      .notNull()
      .references(() => userGroupsTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
  },
  t => [primaryKey({ columns: [t.user_group_id, t.user_id] })],
)

export const allowedEmailsTable = pgTable("allowed_emails", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 255 }).notNull(),
  property_id: integer("property_id").references(
    (): AnyPgColumn => propertyTable.id,
  ),
  user_group_id: integer("user_group_id").references(() => userGroupsTable.id),
  ownership_pct: numeric("ownership_pct", { precision: 5, scale: 2 }),
  added_by_user_id: integer("added_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  used_at: timestamp("used_at"),
  used_by_user_id: integer("used_by_user_id").references(() => usersTable.id),
  created_at: timestamp("created_at").notNull().defaultNow(),
})
