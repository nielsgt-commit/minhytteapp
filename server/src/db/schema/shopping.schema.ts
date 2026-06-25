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

export const shoppingListItemsTable = pgTable("shopping_list_items", {
  id: serial("id").primaryKey(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  section: varchar("section", {
    length: 5,
    enum: ["food", "other"],
  }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  checked: boolean("checked").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  created_by: integer("created_by").references(() => usersTable.id),
})
