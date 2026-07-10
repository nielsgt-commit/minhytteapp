// ============================================================
// maintenance — public surface for other features.
//
// Import surface:
//   import { ... } from "@/features/maintenance"
//
// The dashboard's planned-maintenance summary renders due labels using
// the same domain helpers the maintenance pages use.
//
// Invariants (all feature barrels): re-exports only — no side-effectful
// top-level code — and never import through another feature's barrel.
// ============================================================

export { priorityGroupLabel, staticDueKindLabel } from "./due/maintenanceDue.ts"
