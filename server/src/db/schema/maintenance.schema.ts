import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import type { PortableTextBlock } from "@portabletext/types"
import {
  infrastructureTable,
  propertyTable,
  structuresTable,
} from "./property.schema.ts"
import { userGroupsTable, usersTable } from "./users.schema.ts"

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
  t => [
    check(
      "equipment_acquired_year_range",
      sql`${t.acquired_year} IS NULL OR (${t.acquired_year} BETWEEN 1500 AND 2100)`,
    ),
  ],
)

// Single source of truth for maintenance due kinds. KEEP IN SYNC with the
// maintenance_due_shape CHECK below (its `IN (...)` list is raw SQL and cannot
// import this) and with the client-side `DueKind` in
// client/src/features/maintenance/due/maintenanceDue.ts (can't import server code).
export const dueKindValues = [
  "not_decided",
  "dugnad",
  "opening",
  "closing",
  "priority_week",
  "date",
] as const
export type DueKind = (typeof dueKindValues)[number]

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
    structure_id: integer("structure_id").references(() => structuresTable.id, {
      onDelete: "cascade",
    }),
    infrastructure_id: integer("infrastructure_id").references(
      () => infrastructureTable.id,
      { onDelete: "cascade" },
    ),
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
    equipment_id: integer("equipment_id").references(() => equipmentTable.id, {
      onDelete: "cascade",
    }),
    // The recurring procedure step this work item was raised from, if any (a
    // "needs followup" during an inspection). Null for plain todos and ad-hoc
    // findings. Replaces the former self-referential parent_maintenance_id.
    source_step_id: integer("source_step_id").references(
      (): AnyPgColumn => procedureStepsTable.id,
      { onDelete: "set null" },
    ),
    inspection_id: integer("inspection_id").references(
      (): AnyPgColumn => inspectionsTable.id,
      { onDelete: "set null" },
    ),
    due_kind: varchar("due_kind", {
      length: 13,
      enum: dueKindValues,
    })
      .notNull()
      .default("not_decided"),
    due_priority_group_id: integer("due_priority_group_id").references(
      () => userGroupsTable.id,
      { onDelete: "set null" },
    ),
    due_at: timestamp("due_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    completed_at: timestamp("completed_at"),
  },
  t => [
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
      // The IN (...) lists below are raw SQL — KEEP IN SYNC with dueKindValues above.
      "maintenance_due_shape",
      sql`(
        (${t.due_kind} = 'date' AND ${t.due_at} IS NOT NULL AND ${t.due_priority_group_id} IS NULL)
        OR (${t.due_kind} = 'priority_week' AND ${t.due_priority_group_id} IS NOT NULL AND ${t.due_at} IS NULL)
        OR (${t.due_kind} IN ('not_decided', 'dugnad', 'opening', 'closing') AND ${t.due_at} IS NULL AND ${t.due_priority_group_id} IS NULL)
      )`,
    ),
  ],
)

export const inspectionsTable = pgTable(
  "inspections",
  {
    id: serial("id").primaryKey(),
    structure_id: integer("structure_id").references(() => structuresTable.id, {
      onDelete: "cascade",
    }),
    infrastructure_id: integer("infrastructure_id").references(
      () => infrastructureTable.id,
      { onDelete: "cascade" },
    ),
    equipment_id: integer("equipment_id").references(() => equipmentTable.id, {
      onDelete: "cascade",
    }),
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
  t => [
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

// A recurring checklist step for a location's inspection procedure. Distinct
// from maintenanceTable (one-off work with a todo→done lifecycle): a step is a
// template that surfaces every inspection. The two convert into each other —
// a todo is promoted into a step, and a step marked "needs followup" raises a
// todo (maintenanceTable.source_step_id). "Removing" a step archives it
// (archived_at) so inspection history is preserved.
export const procedureStepsTable = pgTable(
  "procedure_steps",
  {
    id: serial("id").primaryKey(),
    structure_id: integer("structure_id").references(() => structuresTable.id, {
      onDelete: "cascade",
    }),
    infrastructure_id: integer("infrastructure_id").references(
      () => infrastructureTable.id,
      { onDelete: "cascade" },
    ),
    equipment_id: integer("equipment_id").references(() => equipmentTable.id, {
      onDelete: "cascade",
    }),
    description: varchar("description", { length: 255 }).notNull(),
    instructions_pt: jsonb("instructions_pt").$type<PortableTextBlock[]>(),
    position: integer("position"),
    added_by: integer("added_by")
      .notNull()
      .references(() => usersTable.id),
    // The inspection during which this step was first added, for history
    // display ("steps added this inspection"). Null for steps seeded outside an
    // inspection or whose originating inspection was later deleted.
    created_in_inspection_id: integer("created_in_inspection_id").references(
      (): AnyPgColumn => inspectionsTable.id,
      { onDelete: "set null" },
    ),
    created_at: timestamp("created_at").notNull().defaultNow(),
    archived_at: timestamp("archived_at"),
  },
  t => [
    check(
      "procedure_step_location_xor",
      sql`(
        (CASE WHEN ${t.structure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.infrastructure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.equipment_id} IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1`,
    ),
  ],
)
