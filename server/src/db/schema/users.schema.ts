import { integer, pgTable, unique, varchar } from "drizzle-orm/pg-core"

export const usersTable = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  date_of_birth: integer("date_of_birth").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
})

export const relationshipsTable = pgTable("relationships", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  person_1: integer("person_1")
    .notNull()
    .references(() => usersTable.id),
  person_2: integer("person_2")
    .notNull()
    .references(() => usersTable.id),
  relationship_type: varchar("relationship_type", { length: 255 }).notNull(),
  start_date: varchar("start_date", { length: 255 }).notNull(),
  end_date: varchar("end_date", { length: 255 }),
})

export const familiesTable = pgTable("families", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
})

export const familyMembersTable = pgTable(
  "family_members",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    family_id: integer("family_id")
      .notNull()
      .references(() => familiesTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    relationship_type: varchar("relationship_type", {
      length: 6,
      enum: ["parent", "child", "guest"],
    }).notNull(),
  },
  (t) => [unique().on(t.family_id, t.user_id)],
)