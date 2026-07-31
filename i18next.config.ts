import { defineConfig } from "i18next-cli"

export default defineConfig({
  locales: ["en", "nb"],
  extract: {
    input: ["client/src/**/*.{ts,tsx}"],
    ignore: ["**/node_modules/**", "**/*.test.{ts,tsx}", "**/routeTree.gen.ts"],
    output: "client/src/i18n/locales/{{language}}/{{namespace}}.json",
    defaultNS: "common",
    keySeparator: false,
    nsSeparator: false,
    primaryLanguage: "en",
    secondaryLanguages: ["nb"],
    // Natural-key strategy: use the key itself as the EN value
    // and leave NB blank for translators to fill in.
    defaultValue: (key, _ns, language) => (language === "en" ? key : ""),
    sort: true,
    indentation: 2,
    // Keys only referenced dynamically (t(variable)) — the extractor can't
    // see them in source and would otherwise flag/delete them.
    preservePatterns: [
      // Default inventory category names: stored in the DB in English and
      // rendered via t(category.name) (InventoryList, ManageInventoryCategories).
      "Dry goods",
      "Canned goods",
      "Spices",
      "Condiments",
      "Bed linens & textiles",
      "Kitchen equipment",
      "Outdoor & fishing",
      "Tools",
      "Sports equipment",
      "Water sports",
      "Games & books",
      "Cleaning supplies",
      "Consumables & spares",
      "Safety & first aid",
      "Construction materials",
      // Admin banner/nav entries rendered via td(banner.title) in
      // ManageProperty.tsx.
      "Inventory categories",
      "Sections of the food and general inventory lists. Add your own or remove ones you don't need — a category with items in it can't be removed.",
    ],
  },
})
