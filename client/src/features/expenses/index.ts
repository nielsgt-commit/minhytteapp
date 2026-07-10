// ============================================================
// expenses — public surface for other features.
//
// Import surface:
//   import { ... } from "@/features/expenses"
//
// Settlement composes over expenses (the settlement is the aggregate
// process over expense rows) — the allowed dependency direction is
// settlement → expenses, never the reverse.
//
// Invariants (all feature barrels): re-exports only — no side-effectful
// top-level code — and never import back through another feature's barrel
// (a barrel cycle would silently reintroduce the settlement⇄expenses
// cycle this boundary exists to prevent).
// ============================================================

export { ReviewExpenses } from "./reviewexpenses/ReviewExpenses.tsx"
export { selectExpensesToReview, selectMyExpenses } from "./selectors.ts"
export type { ExpenseRow } from "./types.ts"
