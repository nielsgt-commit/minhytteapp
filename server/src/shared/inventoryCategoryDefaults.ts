// Default inventory categories seeded for every property. Categories are
// per-property rows the property head can manage; these are just the starting
// set. `kind` decides which list a category (and its items) belongs to: the
// food inventory on the shopping page or the general inventory page.
export const INVENTORY_CATEGORY_KINDS = ["food", "general"] as const

export type InventoryCategoryKind = (typeof INVENTORY_CATEGORY_KINDS)[number]

// Array order is load-bearing: it is the seed insert order and the canonical
// display order on the inventory lists (defaults first, then customs by id).
export const DEFAULT_INVENTORY_CATEGORIES: readonly {
  name: string
  kind: InventoryCategoryKind
}[] = [
  { name: "Dry goods", kind: "food" },
  { name: "Canned goods", kind: "food" },
  { name: "Spices", kind: "food" },
  { name: "Condiments", kind: "food" },
  { name: "Bed linens & textiles", kind: "general" },
  { name: "Kitchen equipment", kind: "general" },
  { name: "Outdoor & fishing", kind: "general" },
  { name: "Tools", kind: "general" },
  { name: "Sports equipment", kind: "general" },
  { name: "Water sports", kind: "general" },
  { name: "Games & books", kind: "general" },
  { name: "Cleaning supplies", kind: "general" },
  { name: "Consumables & spares", kind: "general" },
  { name: "Safety & first aid", kind: "general" },
  { name: "Construction materials", kind: "general" },
]

const defaultRank = new Map(
  DEFAULT_INVENTORY_CATEGORIES.map((c, i) => [c.name, i]),
)

// Canonical list order: the default categories in their fixed order first,
// then user-created ones by creation (id). Serial ids alone can't be trusted
// for the defaults — properties predating the seed migration got their rows
// lazily in write order.
export function sortInventoryCategories<T extends { id: number; name: string }>(
  categories: readonly T[],
): T[] {
  return [...categories].sort((a, b) => {
    const rankA = defaultRank.get(a.name) ?? Number.MAX_SAFE_INTEGER
    const rankB = defaultRank.get(b.name) ?? Number.MAX_SAFE_INTEGER
    return rankA - rankB || a.id - b.id
  })
}
