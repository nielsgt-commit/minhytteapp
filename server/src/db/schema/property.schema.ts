import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  unique,
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
    .references(() => structuresTable.id, { onDelete: "cascade" }),

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

// A recurring season for a property: a month+day range that repeats every
// year (a range wrapping the year boundary, e.g. Dec 1 – Feb 28, is encoded
// as end < start) plus the ISO weeks that count as priority weeks within it.
// Soft-deleted via archived_at because priority picks reference seasons.
export const propertySeasonsTable = pgTable(
  "property_seasons",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    name: varchar("name", { length: 64 }).notNull(),
    start_month: integer("start_month").notNull(),
    start_day: integer("start_day").notNull(),
    end_month: integer("end_month").notNull(),
    end_day: integer("end_day").notNull(),
    priority_weeks: integer("priority_weeks")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    archived_at: timestamp("archived_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  t => [
    check(
      "property_seasons_start_month_range",
      sql`${t.start_month} BETWEEN 1 AND 12`,
    ),
    check(
      "property_seasons_end_month_range",
      sql`${t.end_month} BETWEEN 1 AND 12`,
    ),
    check(
      "property_seasons_start_day_range",
      sql`${t.start_day} BETWEEN 1 AND 31`,
    ),
    check("property_seasons_end_day_range", sql`${t.end_day} BETWEEN 1 AND 31`),
    uniqueIndex("property_seasons_property_name_active")
      .on(t.property_id, t.name)
      .where(sql`${t.archived_at} IS NULL`),
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
    // NULL = a pick made under the built-in Summer fallback (weeks 28–30),
    // before the property configured any seasons. Which weeks are valid for a
    // season is enforced in the priority router, not by a CHECK.
    season_id: integer("season_id").references(() => propertySeasonsTable.id),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  t => [
    check("priority_week_valid", sql`${t.iso_week} BETWEEN 1 AND 53`),
    // NULLS NOT DISTINCT: one pick per group per year per season, and legacy
    // NULL-season rows keep the old one-per-group-per-year semantics.
    unique("priority_week_uq_group_year_season")
      .on(t.user_group_id, t.year, t.season_id)
      .nullsNotDistinct(),
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
