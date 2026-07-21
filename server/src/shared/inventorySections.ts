// The inventory's fixed sections (food and general lists). Each is stored per
// property as an inventory_categories row of the same name (lazily ensured on
// first write), so the section survives as a plain category reference on the
// item rows.
export const FOOD_SECTIONS = [
  "Dry goods",
  "Canned goods",
  "Spices",
  "Condiments",
] as const

export type FoodSection = (typeof FOOD_SECTIONS)[number]

export const GENERAL_SECTIONS = [
  "Bed linens & textiles",
  "Kitchen equipment",
  "Outdoor & fishing",
  "Tools",
  "Sports equipment",
  "Games & books",
  "Cleaning supplies",
  "Consumables & spares",
  "Safety & first aid",
  "Construction materials",
] as const

export type GeneralSection = (typeof GENERAL_SECTIONS)[number]

export const ALL_SECTIONS = [...FOOD_SECTIONS, ...GENERAL_SECTIONS] as const

export type InventorySection = (typeof ALL_SECTIONS)[number]
