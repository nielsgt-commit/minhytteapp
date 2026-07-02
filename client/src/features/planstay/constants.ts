import { Temporal } from "temporal-polyfill"

function seasonYear() {
  // From September onward the planner targets next summer's season.
  const now = Temporal.Now.plainDateISO()
  return now.month > 8 ? now.year + 1 : now.year
}

export const YEAR = seasonYear()

// Bookable window for the date pickers (and the occupancy-dot map they show):
// stays can land in any season, so this spans from the start of the current
// year (past stays can still be logged) through the end of next year.
const CURRENT_YEAR = Temporal.Now.plainDateISO().year
export const BOOKING_MIN = `${String(CURRENT_YEAR)}-01-01`
export const BOOKING_MAX = `${String(CURRENT_YEAR + 1)}-12-31`

export const BED_LABELS: Record<string, string> = {
  travel_cot: "Travel cot",
  beds_kid: "Kid bed",
  beds_sm: "Single",
  beds_lg: "Large single",
  beds_double: "Double (x2)",
  mattresses: "Mattress",
}

export const MAX_BED_ICONS = 12

export const BED_ICON_COLOR: Record<
  "empty" | "existing" | "draft" | "over",
  string
> = {
  empty: "var(--ds-color-neutral-border-default)",
  existing: "var(--ds-color-neutral-base-default)",
  draft: "var(--ds-color-accent-base-default)",
  over: "var(--ds-color-danger-base-default, #c01c28)",
}
