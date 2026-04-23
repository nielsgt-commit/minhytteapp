import { boolean, integer, pgTable, varchar } from "drizzle-orm/pg-core"

export const usersTable = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  is_admin: boolean("is_admin").notNull().default(true),
  is_child: boolean("is_child"),
})

export const userGroupsTable = pgTable("user_groups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
})