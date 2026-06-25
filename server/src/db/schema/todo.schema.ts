import {
  boolean,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import { propertyTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

export const todosTable = pgTable("todos", {
  id: serial("id").primaryKey(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  description: varchar("description", { length: 255 }).notNull(),
  done: boolean("done").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  created_by: integer("created_by").references(() => usersTable.id),
})
