import {
  boolean,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
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

// One row per user assigned to a shopping item. Cascade so deleting an item
// (including a clearSection sweep) takes its assignments with it.
export const shoppingItemAssigneesTable = pgTable(
  "shopping_item_assignees",
  {
    id: serial("id").primaryKey(),
    item_id: integer("item_id")
      .notNull()
      .references(() => shoppingListItemsTable.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("shopping_item_assignee_uq").on(t.item_id, t.user_id)],
)
