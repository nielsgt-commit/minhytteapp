import { sql } from "drizzle-orm"
import {
  check,
  integer,
  numeric,
  pgTable,
  primaryKey,
  varchar,
} from "drizzle-orm/pg-core"
import { usersTable } from "./users.schema.ts"



export const propertyTable = pgTable("properties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
})

export const buildingsTable = pgTable("buildings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
})

export const roomTable = pgTable("rooms", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  building_id: integer("building_id")
    .notNull()
    .references(() => buildingsTable.id),

  beds_sm: integer("beds_sm").notNull().default(0),
  beds_lg: integer("beds_lg").notNull().default(0),
  beds_double: integer("beds_double").notNull().default(0),
  mattresses: integer("mattresses").notNull().default(0),
  room_type: varchar("room_type", {
    length: 6,
    enum: ["single", "double", "family"],
  }).notNull(),
})

export const buildingAdjacenciesTable = pgTable(
  "building_adjacencies",
  {
    building_a: integer("building_a")
      .notNull()
      .references(() => buildingsTable.id),
    building_b: integer("building_b")
      .notNull()
      .references(() => buildingsTable.id),
  },
  (t) => [
    primaryKey({ columns: [t.building_a, t.building_b] }),
    check("building_adj_order", sql`${t.building_a} < ${t.building_b}`),
  ],
)

export const roomAdjacenciesTable = pgTable(
  "room_adjacencies",
  {
    room_a: integer("room_a")
      .notNull()
      .references(() => roomTable.id),
    room_b: integer("room_b")
      .notNull()
      .references(() => roomTable.id),
  },
  (t) => [
    primaryKey({ columns: [t.room_a, t.room_b] }),
    check("room_adj_order", sql`${t.room_a} < ${t.room_b}`),
  ],
)

export const propertyOwnersTable = pgTable(
  "property_owners",
  {
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    ownership_pct: numeric("ownership_pct", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.property_id, t.user_id] })],
)

export const placeTable = pgTable("places", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  property_id: integer("property_id").references(() => propertyTable.id),
})