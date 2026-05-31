import { sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import { propertyTable } from "./property.schema.ts"

export const usersTable = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    email_verified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    is_admin: boolean("is_admin").notNull().default(false),
    is_child: boolean("is_child").notNull().default(false),
    parent_user_id: integer("parent_user_id").references(
      (): AnyPgColumn => usersTable.id,
    ),
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
        "expenses",
        "done",
      ],
    }),
    onboarding_dismissed_at: timestamp("onboarding_dismissed_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  t => [
    uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
    index("users_parent_user_id_idx").on(t.parent_user_id),
  ],
)

export const userGroupsTable = pgTable(
  "user_groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    is_family: boolean("is_family").notNull().default(false),
    property_id: integer("property_id").references(
      (): AnyPgColumn => propertyTable.id,
    ),
  },
  // NOTE: is_family marks a "family/household (owning) group" — a property can
  // have several. The real invariant is "a user belongs to at most one family
  // group per property", which spans user_group_members + user_groups and is
  // enforced in app logic, not a DB unique index.
)

export const userGroupMembersTable = pgTable(
  "user_group_members",
  {
    user_group_id: integer("user_group_id")
      .notNull()
      .references(() => userGroupsTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    is_head: boolean("is_head").notNull().default(false),
  },
  t => [
    primaryKey({ columns: [t.user_group_id, t.user_id] }),
    index("user_group_members_user_id_idx").on(t.user_id),
  ],
)

export const allowedEmailsTable = pgTable(
  "allowed_emails",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: varchar("email", { length: 255 }).notNull(),
    property_id: integer("property_id").references(
      (): AnyPgColumn => propertyTable.id,
    ),
    user_group_id: integer("user_group_id").references(
      () => userGroupsTable.id,
    ),
    ownership_pct: numeric("ownership_pct", { precision: 5, scale: 2 }),
    added_by_user_id: integer("added_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    used_at: timestamp("used_at"),
    used_by_user_id: integer("used_by_user_id").references(() => usersTable.id),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  t => [
    index("allowed_emails_email_idx").on(t.email),
    index("allowed_emails_property_id_idx").on(t.property_id),
    index("allowed_emails_email_lower_idx").on(sql`lower(${t.email})`),
    uniqueIndex("allowed_emails_pending_property_uq")
      .on(sql`lower(${t.email})`, t.property_id)
      .where(sql`${t.used_at} IS NULL AND ${t.property_id} IS NOT NULL`),
    uniqueIndex("allowed_emails_pending_global_uq")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.used_at} IS NULL AND ${t.property_id} IS NULL`),
  ],
)
