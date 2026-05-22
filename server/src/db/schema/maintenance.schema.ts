import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import type { PortableTextBlock } from "@portabletext/types"
import { infrastructureTable, propertyTable, structuresTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

export const routinesTable = pgTable("routines", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }),
})

export const equipmentTable = pgTable(
  "equipment",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    brand: varchar("brand", { length: 64 }),
    model: varchar("model", { length: 64 }),
    category: varchar("category", { length: 32 }),
    notes: varchar("notes", { length: 255 }),
    acquired_year: integer("acquired_year"),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "equipment_acquired_year_range",
      sql`${t.acquired_year} IS NULL OR (${t.acquired_year} BETWEEN 1500 AND 2100)`,
    ),
  ],
)

export const maintenanceTable = pgTable(
  "maintenance",
  {
    id: serial("id").primaryKey(),
    description: varchar("description", { length: 255 }).notNull(),
    instructions_pt: jsonb("instructions_pt").$type<PortableTextBlock[]>(),
    added_by: integer("added_by")
      .notNull()
      .references(() => usersTable.id),
    assigned_to_id: integer("assigned_to_id").references(() => usersTable.id),
    structure_id: integer("structure_id").references(() => structuresTable.id),
    infrastructure_id: integer("infrastructure_id").references(() => infrastructureTable.id),
    category: varchar("category", {
      length: 11,
      enum: ["maintenance", "repair"],
    }).notNull(),
    severity: varchar("severity", {
      length: 5,
      enum: ["major", "minor", "patch"],
    }).notNull(),
    status: varchar("status", {
      length: 5,
      enum: ["todo", "doing", "done"],
    }).notNull(),
    recurrence: varchar("recurrence", {
      length: 6,
      enum: ["once", "yearly", "5year", "spring", "fall"],
    }).notNull(),
    routine_id: integer("routine_id").references(() => routinesTable.id),
    routine_position: integer("routine_position"),
    equipment_id: integer("equipment_id").references(() => equipmentTable.id),
    is_pinned: boolean("is_pinned").notNull().default(false),
    procedure_position: integer("procedure_position"),
    parent_maintenance_id: integer("parent_maintenance_id").references(
      (): AnyPgColumn => maintenanceTable.id,
    ),
    inspection_id: integer("inspection_id").references(
      (): AnyPgColumn => inspectionsTable.id,
    ),
    due_at: timestamp("due_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    completed_at: timestamp("completed_at"),
  },
  (t) => [
    check(
      "maintenance_location_xor",
      sql`(
        (CASE WHEN ${t.structure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.infrastructure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.equipment_id} IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1`,
    ),
    check(
      "maintenance_done_has_timestamp",
      sql`(${t.status} = 'done') = (${t.completed_at} IS NOT NULL)`,
    ),
    check(
      "maintenance_routine_position_pairing",
      sql`(${t.routine_id} IS NULL) = (${t.routine_position} IS NULL)`,
    ),
  ],
)

export const inspectionsTable = pgTable(
  "inspections",
  {
    id: serial("id").primaryKey(),
    structure_id: integer("structure_id").references(() => structuresTable.id),
    infrastructure_id: integer("infrastructure_id").references(() => infrastructureTable.id),
    equipment_id: integer("equipment_id").references(() => equipmentTable.id),
    started_by_user_id: integer("started_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    inspected_by: varchar("inspected_by", { length: 255 }).notNull(),
    recurrence: varchar("recurrence", {
      length: 6,
      enum: ["yearly", "5year", "spring", "fall"],
    }).notNull(),
    notes_pt: jsonb("notes_pt").$type<PortableTextBlock[]>(),
    started_at: timestamp("started_at").notNull().defaultNow(),
    completed_at: timestamp("completed_at"),
  },
  (t) => [
    check(
      "inspection_target_exclusive",
      sql`(
        (CASE WHEN ${t.structure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.infrastructure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.equipment_id} IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1`,
    ),
  ],
)

export const maintenanceUpdatesTable = pgTable("maintenance_updates", {
  id: serial("id").primaryKey(),
  maintenance_id: integer("maintenance_id")
    .notNull()
    .references(() => maintenanceTable.id, { onDelete: "cascade" }),
  author_id: integer("author_id")
    .notNull()
    .references(() => usersTable.id),
  body: text("body").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
})

export const maintenanceAttachmentsTable = pgTable("maintenance_attachments", {
  id: serial("id").primaryKey(),
  maintenance_id: integer("maintenance_id")
    .notNull()
    .references(() => maintenanceTable.id, { onDelete: "cascade" }),
  uploaded_by: integer("uploaded_by")
    .notNull()
    .references(() => usersTable.id),
  url: text("url").notNull(),
  caption: varchar("caption", { length: 255 }),
  created_at: timestamp("created_at").notNull().defaultNow(),
})