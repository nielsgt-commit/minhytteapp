import { sql } from "drizzle-orm"
import {
  check,
  index,
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
    in_family_since: integer("in_family_since"),
    parking_spots: integer("parking_spots").notNull().default(0),
    adressekode: integer("adressekode"),
    kommunenummer: varchar("kommunenummer", { length: 4 }),
    gardsnummer: integer("gardsnummer"),
    bruksnummer: integer("bruksnummer"),
    festenummer: integer("festenummer"),
    undernummer: integer("undernummer"),
    latitude: numeric("latitude", { precision: 7, scale: 4 }),
    longitude: numeric("longitude", { precision: 7, scale: 4 }),
  },
  t => [
    check("parking_spots_nonneg", sql`${t.parking_spots} >= 0`),
    check(
      "properties_in_family_since_range",
      sql`${t.in_family_since} IS NULL OR (${t.in_family_since} BETWEEN 1500 AND 2100)`,
    ),
  ],
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
  t => [
    primaryKey({ columns: [t.property_id, t.slot_index] }),
    check("parking_slot_nonneg", sql`${t.slot_index} >= 0`),
  ],
)

export const structuresTable = pgTable(
  "structures",
  {
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
    built_year: integer("built_year"),
  },
  t => [
    check(
      "structures_built_year_range",
      sql`${t.built_year} IS NULL OR (${t.built_year} BETWEEN 1500 AND 2100)`,
    ),
  ],
)

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

export const propertyOwnersTable = pgTable(
  "property_owners",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    user_group_id: integer("user_group_id")
      .notNull()
      .references(() => userGroupsTable.id),
    ownership_pct: numeric("ownership_pct", {
      precision: 5,
      scale: 2,
    }).notNull(),
  },
  t => [
    uniqueIndex("property_owners_group_uq")
      .on(t.property_id, t.user_group_id)
      .where(sql`${t.user_group_id} IS NOT NULL`),
    index("property_owners_user_group_id_idx")
      .on(t.user_group_id)
      .where(sql`${t.user_group_id} IS NOT NULL`),
  ],
)

export const infrastructureTable = pgTable(
  "infrastructure",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 255 }),
    property_id: integer("property_id").references(() => propertyTable.id),
    since_year: integer("since_year"),
  },
  t => [
    check(
      "infrastructure_since_year_range",
      sql`${t.since_year} IS NULL OR (${t.since_year} BETWEEN 1500 AND 2100)`,
    ),
  ],
)

export const propertyPriorityWeeksTable = pgTable(
  "property_priority_weeks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    user_group_id: integer("user_group_id")
      .notNull()
      .references(() => userGroupsTable.id),
    year: integer("year").notNull(),
    iso_week: integer("iso_week").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  t => [
    check("priority_week_peak_only", sql`${t.iso_week} IN (28, 29, 30)`),
    uniqueIndex("priority_week_uq_group_year").on(t.user_group_id, t.year),
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
