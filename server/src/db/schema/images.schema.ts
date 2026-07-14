import { sql } from "drizzle-orm"
import {
  check,
  customType,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { equipmentTable } from "./maintenance.schema.ts"
import {
  infrastructureTable,
  propertyTable,
  structuresTable,
} from "./property.schema.ts"
import { usersTable } from "./users.schema.ts"

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea"
  },
})

// Cover images, stored in-database as sharp-processed webp (the Render free
// tier has no persistent disk, and object storage would be a new external
// dependency for a handful of small covers). Replacing a cover deletes the
// old row and inserts a new one — an image id is therefore immutable and the
// GET route can serve it with a long-lived cache header. One cover per
// structure/equipment, enforced by the partial unique indexes.
export const imagesTable = pgTable(
  "images",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    property_id: integer("property_id")
      .notNull()
      .references(() => propertyTable.id),
    structure_id: integer("structure_id").references(() => structuresTable.id, {
      onDelete: "cascade",
    }),
    infrastructure_id: integer("infrastructure_id").references(
      () => infrastructureTable.id,
      { onDelete: "cascade" },
    ),
    equipment_id: integer("equipment_id").references(() => equipmentTable.id, {
      onDelete: "cascade",
    }),
    data: bytea("data").notNull(),
    mime_type: varchar("mime_type", { length: 32 }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    uploaded_by: integer("uploaded_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  t => [
    check(
      "images_target_xor",
      sql`(
        (CASE WHEN ${t.structure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.infrastructure_id} IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN ${t.equipment_id} IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1`,
    ),
    uniqueIndex("images_structure_cover_uq")
      .on(t.structure_id)
      .where(sql`${t.structure_id} IS NOT NULL`),
    uniqueIndex("images_infrastructure_cover_uq")
      .on(t.infrastructure_id)
      .where(sql`${t.infrastructure_id} IS NOT NULL`),
    uniqueIndex("images_equipment_cover_uq")
      .on(t.equipment_id)
      .where(sql`${t.equipment_id} IS NOT NULL`),
  ],
)
