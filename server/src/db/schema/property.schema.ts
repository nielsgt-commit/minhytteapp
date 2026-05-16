import { sql } from "drizzle-orm"
import {
  check,
  integer,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { userGroupsTable, usersTable } from "./users.schema.ts"



export const propertyTable = pgTable(
  "properties",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    address: varchar("address", { length: 255 }).notNull(),
    link: varchar("link", { length: 255 }),
    parking_spots: integer("parking_spots").notNull().default(0),
  },
  (t) => [check("parking_spots_nonneg", sql`${t.parking_spots} >= 0`)],
)

export const parkingClaimsTable = pgTable(
  "parking_claims",
  {
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    slot_index: integer("slot_index").notNull(),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    claimed_at: timestamp("claimed_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.property_id, t.slot_index] }),
    check("parking_slot_nonneg", sql`${t.slot_index} >= 0`),
  ],
)

export const structuresTable = pgTable("structures", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  category: varchar("category", {
    length: 16,
    enum: ["habitable", "non_habitable"],
  })
    .notNull()
    .default("habitable"),
})

export const roomTable = pgTable("rooms", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  structure_id: integer("structure_id")
    .notNull()
    .references(() => structuresTable.id),

  beds_sm: integer("beds_sm").notNull().default(0),
  beds_lg: integer("beds_lg").notNull().default(0),
  beds_double: integer("beds_double").notNull().default(0),
  beds_kid: integer("beds_kid").notNull().default(0),
  mattresses: integer("mattresses").notNull().default(0),
  travel_cot: integer("travel_cot").notNull().default(0),
})

export const structureAdjacenciesTable = pgTable(
  "structure_adjacencies",
  {
    structure_a: integer("structure_a")
      .notNull()
      .references(() => structuresTable.id),
    structure_b: integer("structure_b")
      .notNull()
      .references(() => structuresTable.id),
  },
  (t) => [
    primaryKey({ columns: [t.structure_a, t.structure_b] }),
    check("structure_adj_order", sql`${t.structure_a} < ${t.structure_b}`),
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
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    user_id: integer("user_id").references(() => usersTable.id),
    user_group_id: integer("user_group_id").references(() => userGroupsTable.id),
    ownership_pct: numeric("ownership_pct", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [
    check(
      "property_owners_exactly_one_ref",
      sql`(${t.user_id} IS NULL) <> (${t.user_group_id} IS NULL)`,
    ),
    uniqueIndex("property_owners_user_uq")
      .on(t.property_id, t.user_id)
      .where(sql`${t.user_id} IS NOT NULL`),
    uniqueIndex("property_owners_group_uq")
      .on(t.property_id, t.user_group_id)
      .where(sql`${t.user_group_id} IS NOT NULL`),
  ],
)

export const infrastructureTable = pgTable("infrastructure", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  property_id: integer("property_id").references(() => propertyTable.id),
})

export const propertyPriorityWeeksTable = pgTable(
  "property_priority_weeks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    property_owner_id: integer("property_owner_id")
      .notNull()
      .references(() => propertyOwnersTable.id),
    year: integer("year").notNull(),
    iso_week: integer("iso_week").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("priority_week_peak_only", sql`${t.iso_week} IN (28, 29, 30)`),
    uniqueIndex("priority_week_uq_owner_year").on(
      t.property_owner_id,
      t.year,
    ),
  ],
)

export const propertyContactsTable = pgTable("property_contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 255 }),
  info: varchar("info", { length: 1024 }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
})

export const propertyInvitationsTable = pgTable("property_invitations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  email: varchar("email", { length: 255 }).notNull(),
  ownership_pct: numeric("ownership_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0.00"),
  expires_at: timestamp("expires_at").notNull(),
  used_at: timestamp("used_at"),
  used_by_user_id: integer("used_by_user_id").references(() => usersTable.id),
  created_by_user_id: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  created_at: timestamp("created_at").notNull().defaultNow(),
})
