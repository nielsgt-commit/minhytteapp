import { sql } from "drizzle-orm"
import {
  check,
  date,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { propertyTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

export const stayTable = pgTable(
  "stays",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    start_date: date("start_date").notNull(),
    end_date: date("end_date"),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  t => [
    check(
      "stay_date_order",
      sql`${t.end_date} IS NULL OR ${t.start_date} <= ${t.end_date}`,
    ),
    uniqueIndex("stay_open_per_user_property_uq")
      .on(t.user_id, t.property_id)
      .where(sql`${t.end_date} IS NULL`),
  ],
)
