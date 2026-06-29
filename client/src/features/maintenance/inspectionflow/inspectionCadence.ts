import type { TFunction } from "i18next"
import { priorityGroupLabel } from "@/features/maintenance/due/maintenanceDue.ts"

// An inspection's cadence — how often (or on which occasion) it recurs. Mirrors
// the todo Due select's timing taxonomy (dugnad / opening / closing / a family
// group's priority week) alongside the seasonal spring/fall. KEEP IN SYNC with
// the server's recurrence enum in inspection.ts (client can't import server
// code). "yearly" is legacy-only: stored on older inspections and still
// rendered, but no longer offered as a new choice (replaced by spring/fall).
export type Cadence =
  | "yearly"
  | "spring"
  | "fall"
  | "dugnad"
  | "opening"
  | "closing"
  | "priority_week"

// Cadences a user can pick (everything except legacy "yearly"). priority_week
// is chosen via a group option, so it's not in the static list below.
export type SelectableCadence = Exclude<Cadence, "yearly">

// The static (non-group) cadences offered when recording an inspection, in
// display order. "yearly" is intentionally excluded (legacy-only).
export const SELECTABLE_CADENCES = [
  "spring",
  "fall",
  "dugnad",
  "opening",
  "closing",
] as const satisfies readonly SelectableCadence[]

// A stored cadence, for display — may be the legacy "yearly".
export type CadenceValue = {
  recurrence: Cadence
  cadence_priority_group_id?: number | null
}

// A cadence the user selected when recording — never "yearly".
export type CadenceSelection = {
  recurrence: SelectableCadence
  cadence_priority_group_id?: number
}

const GROUP_PREFIX = "group:"

export function cadenceToToken(c: CadenceValue): string {
  if (c.recurrence === "priority_week" && c.cadence_priority_group_id != null) {
    return `${GROUP_PREFIX}${String(c.cadence_priority_group_id)}`
  }
  return c.recurrence
}

export function tokenToCadence(token: string): CadenceSelection {
  if (token.startsWith(GROUP_PREFIX)) {
    return {
      recurrence: "priority_week",
      cadence_priority_group_id: Number(token.slice(GROUP_PREFIX.length)),
    }
  }
  // The select never offers "yearly", so a plain token is a SelectableCadence.
  return { recurrence: token as SelectableCadence }
}

// Label for a static cadence. Priority-week cadences are labelled per group via
// priorityGroupLabel (and need the group name, so they're handled by callers).
export function cadenceLabel(t: TFunction, cadence: Cadence): string {
  switch (cadence) {
    case "yearly":
      return t("Yearly")
    case "spring":
      return t("Every spring")
    case "fall":
      return t("Every fall")
    case "dugnad":
      return t("Dugnad")
    case "opening":
      return t("Opening")
    case "closing":
      return t("Closing")
    case "priority_week":
      return t("Priority week")
  }
}

export { priorityGroupLabel }
