import { sql } from "drizzle-orm"
import {
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
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
  },
  (t) => [check("booking_date_order", sql`${t.start_date} <= ${t.end_date}`)],
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
    mattresses: integer("mattresses").notNull().default(0),
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
  },
  (t) => [primaryKey({ columns: [t.booking_id, t.user_id] })],
)