// ============================================================
// property — public surface for other features.
//
// Import surface:
//   import { ... } from "@/features/property"
//
// Onboarding composes the property-setup building blocks (address
// lookup, bed configuration) into its guided flow.
//
// Invariants (all feature barrels): re-exports only — no side-effectful
// top-level code — and never import through another feature's barrel.
// ============================================================

export {
  AddressLookup,
  type GeonorgeAddress,
} from "./register/AddressLookup.tsx"
export { AddBedsFlow, type RoomData } from "./structures/AddBedsFlow.tsx"
