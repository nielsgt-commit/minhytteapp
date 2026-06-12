import type { TFunction } from "i18next"
import type { Temporal } from "temporal-polyfill"

// Mirror of the server's dueKindValues in
// server/src/db/schema/maintenance.schema.ts — KEEP IN SYNC (client can't import
// server code). The server zod enum and DB CHECK derive from that source.
export type DueKind =
  | "not_decided"
  | "dugnad"
  | "opening"
  | "closing"
  | "priority_week"
  | "date"

export const STATIC_DUE_KINDS = [
  "not_decided",
  "dugnad",
  "opening",
  "closing",
] as const

export type DueValue = {
  due_kind: DueKind
  due_priority_group_id?: number | null
  due_at?: Temporal.Instant | null
}

export type DueSelection = {
  due_kind: DueKind
  due_priority_group_id?: number
  due_at?: Temporal.Instant
}

const GROUP_PREFIX = "group:"

export function dueToToken(d: DueValue): string {
  if (d.due_kind === "priority_week" && d.due_priority_group_id != null) {
    return `${GROUP_PREFIX}${String(d.due_priority_group_id)}`
  }
  return d.due_kind
}

export function tokenToDue(
  token: string,
  due_at?: Temporal.Instant,
): DueSelection {
  if (token.startsWith(GROUP_PREFIX)) {
    return {
      due_kind: "priority_week",
      due_priority_group_id: Number(token.slice(GROUP_PREFIX.length)),
    }
  }
  if (token === "date") {
    return { due_kind: "date", due_at }
  }
  return { due_kind: token as DueKind }
}

export function staticDueKindLabel(t: TFunction, kind: DueKind): string {
  switch (kind) {
    case "not_decided":
      return t("Not decided")
    case "dugnad":
      return t("Dugnad")
    case "opening":
      return t("Opening")
    case "closing":
      return t("Closing")
    case "date":
      return t("Specific date")
    default:
      return kind
  }
}

export function priorityGroupLabel(t: TFunction, name: string): string {
  return t("{{name}} week", { name })
}
