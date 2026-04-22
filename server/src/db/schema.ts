import { integer, pgTable, varchar } from "drizzle-orm/pg-core"

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  age: integer().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  org: varchar({ length: 255 }).notNull(),
})


export const propertyTable = pgTable("properties", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  address: varchar({ length: 255 }).notNull(),
})



