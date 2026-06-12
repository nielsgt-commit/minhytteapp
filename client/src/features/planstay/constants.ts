import { Temporal } from "temporal-polyfill"

function seasonYear() {
  // From September onward the planner targets next summer's season.
  const now = Temporal.Now.plainDateISO()
  return now.month > 8 ? now.year + 1 : now.year
}

export const YEAR = seasonYear()
export const SEASON_MIN = `${String(YEAR)}-05-01`
export const SEASON_MAX = `${String(YEAR)}-08-31`

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
