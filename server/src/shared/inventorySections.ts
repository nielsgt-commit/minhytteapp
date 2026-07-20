// The food inventory's fixed sections. Each is stored per property as an
// inventory_categories row of the same name (lazily ensured on first write),
// so the section survives as a plain category reference on the item rows.
export const FOOD_SECTIONS = [
  "Dry goods",
  "Canned goods",
  "Spices",
  "Condiments",
] as const

export type FoodSection = (typeof FOOD_SECTIONS)[number]
