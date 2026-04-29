import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { propertyTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

export const eventTable = pgTable("events", {
  id: serial("id").primaryKey(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  author_id: integer("author_id")
    .notNull()
    .references(() => usersTable.id),
  body: text("body").notNull(),
  expires_on: date("expires_on"),
  created_at: timestamp("created_at").notNull().defaultNow(),
})