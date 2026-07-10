// Deterministic, app-wide colors for family/user groups.
//
// Keyed by the `user_groups.id`, so the same group always renders the same
// color everywhere — calendar dots, member lists, owner chips — with no DB
// column to maintain. Trade-off: with more groups than palette entries two
// groups can share a color (acceptable for the handful of families a property
// has). If per-group customization is ever needed, swap this for a persisted
// `color` column without changing call sites.

// A distinct, reasonably color-blind-friendly palette that reads on both the
// light and dark calendar backgrounds.
export const GROUP_PALETTE = [
  "#1d70b8", // blue
  "#d4351c", // red
  "#00703c", // green
  "#b58840", // gold
  "#6f42c1", // purple
  "#d53880", // pink
  "#28a197", // teal
  "#5694ca", // sky
  "#85994b", // olive
  "#f47738", // orange
] as const

/** Stable color for a group id. Safe for any integer id (incl. negatives). */
export function groupColor(groupId: number): string {
  const n = GROUP_PALETTE.length
  return GROUP_PALETTE[((groupId % n) + n) % n]
}
