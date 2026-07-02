import {
  date,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { propertyTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

// One row per user responsible for dinner on a given day at a property.
export const dinnerResponsiblesTable = pgTable(
  "dinner_responsibles",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  t => [
    uniqueIndex("dinner_responsible_uq").on(t.property_id, t.date, t.user_id),
  ],
)
