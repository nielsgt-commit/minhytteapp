import { sql } from "drizzle-orm"
import {
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import { buildingsTable, placeTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

export const routinesTable = pgTable("routines", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }),
})

export const maintenanceTable = pgTable(
  "maintenance",
  {
    id: serial("id").primaryKey(),
    description: varchar("description", { length: 255 }).notNull(),
    summary: varchar("summary", { length: 255 }),
    added_by: integer("added_by")
      .notNull()
      .references(() => usersTable.id),
    assigned_to_id: integer("assigned_to_id").references(() => usersTable.id),
    building_id: integer("building_id").references(() => buildingsTable.id),
    place_id: integer("place_id").references(() => placeTable.id),
    category: varchar("category", {
      length: 10,
      enum: [
        "plumbing",
        "electrical",
        "grounds",
        "exterior",
        "interior",
        "other",
      ],
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
      length: 9,
      enum: ["ephemeral", "recurring"],
    }).notNull(),
    recurrence_interval_days: integer("recurrence_interval_days"),
    routine_id: integer("routine_id").references(() => routinesTable.id),
    routine_position: integer("routine_position"),
    due_at: timestamp("due_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    completed_at: timestamp("completed_at"),
  },
  (t) => [
    check(
      "maintenance_location_xor",
      sql`(${t.building_id} IS NOT NULL) <> (${t.place_id} IS NOT NULL)`,
    ),
    check(
      "maintenance_done_has_timestamp",
      sql`(${t.status} = 'done') = (${t.completed_at} IS NOT NULL)`,
    ),
    check(
      "maintenance_routine_position_pairing",
      sql`(${t.routine_id} IS NULL) = (${t.routine_position} IS NULL)`,
    ),
    check(
      "maintenance_recurrence_interval_pairing",
      sql`(${t.recurrence} = 'recurring') = (${t.recurrence_interval_days} IS NOT NULL)`,
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