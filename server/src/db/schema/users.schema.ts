import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  varchar,
} from "drizzle-orm/pg-core"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

export const usersTable = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  oauth_sub: varchar("oauth_sub", { length: 255 }).unique(),
  is_admin: boolean("is_admin").notNull().default(false),
  is_child: boolean("is_child"),
  parent_user_id: integer("parent_user_id").references(
    (): AnyPgColumn => usersTable.id,
  ),
})

export const userGroupsTable = pgTable("user_groups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  is_main: boolean("is_main").notNull().default(false),
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
  (t) => [primaryKey({ columns: [t.user_group_id, t.user_id] })],
)