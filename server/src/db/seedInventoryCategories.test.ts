// The property-creation seeding helper: every new property gets the full
// default category set, in canonical order, with the right kinds.

import { afterAll, describe, expect, it } from "vitest"
import { asc, eq } from "drizzle-orm"
import { pool } from "./client.ts"
import { inventoryCategoriesTable } from "./schema/inventory.schema.ts"
import { propertyTable } from "./schema/property.schema.ts"
import { DEFAULT_INVENTORY_CATEGORIES } from "../shared/inventoryCategoryDefaults.ts"
import { withRollback } from "../trpc/test-utils.ts"
import { seedDefaultInventoryCategories } from "./seedInventoryCategories.ts"

afterAll(async () => {
  await pool.end()
})

describe("seedDefaultInventoryCategories", () => {
  it("inserts the full default set in canonical order", async () => {
    await withRollback(async tx => {
      const [prop] = await tx
        .insert(propertyTable)
        .values({ name: "Seed Test Prop", address: "addr" })
        .returning()

      await seedDefaultInventoryCategories(tx, prop.id)

      const rows = await tx
        .select({
          name: inventoryCategoriesTable.name,
          kind: inventoryCategoriesTable.kind,
          archived_at: inventoryCategoriesTable.archived_at,
        })
        .from(inventoryCategoriesTable)
        .where(eq(inventoryCategoriesTable.property_id, prop.id))
        .orderBy(asc(inventoryCategoriesTable.id))

      expect(rows.map(r => ({ name: r.name, kind: r.kind }))).toEqual(
        DEFAULT_INVENTORY_CATEGORIES.map(c => ({ name: c.name, kind: c.kind })),
      )
      expect(rows.every(r => r.archived_at === null)).toBe(true)
    })
  })
})
