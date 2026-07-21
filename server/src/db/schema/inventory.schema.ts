import { sql } from "drizzle-orm"
import {
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { propertyTable, roomTable, structuresTable } from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

// Category labels for inventory lists (food, linens, appliances, ...). v1 has
// a single seeded "Food" category per property and no management UI; removing
// a category archives it (archived_at) rather than deleting, so items keep
// their reference. Mirrors equipment_categories.
export const inventoryCategoriesTable = pgTable(
  "inventory_categories",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    name: varchar("name", { length: 32 }).notNull(),
    archived_at: timestamp("archived_at"),
  },
  t => [
    uniqueIndex("inventory_categories_property_name_active")
      .on(t.property_id, t.name)
      .where(sql`${t.archived_at} IS NULL`),
  ],
)

// Things kept at the property that are too small for equipment maintenance —
// food stock, bed linens, kitchen utensils. Location is a freetext hint
// ("Kitchen") optionally anchored to a building/room; deleting a building or
// room must not delete the things stored there, so the refs just fall away.
export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  property_id: integer("property_id")
    .notNull()
    .references(() => propertyTable.id),
  category_id: integer("category_id")
    .notNull()
    .references(() => inventoryCategoriesTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: integer("quantity"),
  location: varchar("location", { length: 255 }),
  structure_id: integer("structure_id").references(() => structuresTable.id, {
    onDelete: "set null",
  }),
  room_id: integer("room_id").references(() => roomTable.id, {
    onDelete: "set null",
  }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  created_by: integer("created_by").references(() => usersTable.id),
  // Null until first edited: "last touched" falls back to created_at/by.
  updated_at: timestamp("updated_at"),
  updated_by: integer("updated_by").references(() => usersTable.id),
})
