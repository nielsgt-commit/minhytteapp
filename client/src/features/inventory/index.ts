// ============================================================
// inventory — public surface for other features.
//
// Import surface:
//   import { ... } from "@/features/inventory"
//
// The shopping list page composes over inventory (both lists share the
// /handleliste route) — the allowed dependency direction is
// shoppinglist → inventory, never the reverse.
//
// Invariants (all feature barrels): re-exports only — no side-effectful
// top-level code — and never import back through another feature's barrel.
// ============================================================

export { FoodInventory } from "./FoodInventory.tsx"
