import { sql } from "drizzle-orm"
import {
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import { propertyTable, roomTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

export const bookingTable = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    booker_id: integer("booker_id")
      .notNull()
      .references(() => usersTable.id),
    start_date: date("start_date").notNull(),
    end_date: date("end_date").notNull(),
    status: varchar("status", {
      length: 9,
      enum: ["pending", "confirmed", "cancelled"],
    })
      .notNull()
      .default("confirmed"),
    notes: varchar("notes", { length: 1024 }),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    cancelled_at: timestamp("cancelled_at"),
    cancelled_by_id: integer("cancelled_by_id").references(() => usersTable.id),
  },
  (t) => [
    check("booking_date_order", sql`${t.start_date} <= ${t.end_date}`),
    check(
      "booking_cancelled_has_timestamp",
      sql`(${t.status} = 'cancelled') = (${t.cancelled_at} IS NOT NULL)`,
    ),
  ],
)

export const bookingRoomsTable = pgTable(
  "booking_rooms",
  {
    booking_id: integer("booking_id")
      .notNull()
      .references(() => bookingTable.id),
    room_id: integer("room_id")
      .notNull()
      .references(() => roomTable.id),
    beds_sm: integer("beds_sm").notNull().default(0),
    beds_lg: integer("beds_lg").notNull().default(0),
    beds_double: integer("beds_double").notNull().default(0),
    beds_kid: integer("beds_kid").notNull().default(0),
    mattresses: integer("mattresses").notNull().default(0),
    travel_cot: integer("travel_cot").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.booking_id, t.room_id] })],
)

export const bookingOccupantsTable = pgTable(
  "booking_occupants",
  {
    booking_id: integer("booking_id")
      .notNull()
      .references(() => bookingTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    room_id: integer("room_id").references(() => roomTable.id),
  },
  (t) => [primaryKey({ columns: [t.booking_id, t.user_id] })],
)