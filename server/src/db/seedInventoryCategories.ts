import type { db as dbClient } from "./client.ts"
import { inventoryCategoriesTable } from "./schema/inventory.schema.ts"
import { DEFAULT_INVENTORY_CATEGORIES } from "../shared/inventoryCategoryDefaults.ts"

type Db = typeof dbClient
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

// Every new property starts with the default inventory categories (heads can
// rename/archive them later). Insert order follows the defaults array so the
// serial ids match the canonical display order. Existing properties got the
// same set via migration 0097.
export async function seedDefaultInventoryCategories(
  db: Db | Tx,
  propertyId: number,
): Promise<void> {
  await db.insert(inventoryCategoriesTable).values(
    DEFAULT_INVENTORY_CATEGORIES.map(c => ({
      property_id: propertyId,
      name: c.name,
      kind: c.kind,
    })),
  )
}
