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

// Per-property, head-managed category labels for inventory lists. `kind`
// splits them between the food inventory (/handleliste) and the general one
// (/inventar). Every property is seeded with a default set; removing a
// category archives it (archived_at) rather than deleting, so the name stays
// reusable while historical rows keep their reference. The partial unique
// index makes names unique per property across kinds. Mirrors
// equipment_categories.
export const inventoryCategoriesTable = pgTable(
  "inventory_categories",
  {
    id: serial("id").primaryKey(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    name: varchar("name", { length: 32 }).notNull(),
    // The DB default matches the migration backfill rule: legacy categories
    // outside the known general sections read as food. The server always sets
    // kind explicitly.
    kind: varchar("kind", { length: 7, enum: ["food", "general"] })
      .notNull()
      .default("food"),
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
