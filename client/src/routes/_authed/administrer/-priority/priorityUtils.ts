import { Temporal } from "temporal-polyfill"
import { isoWeekMonday } from "@/utils/dateUtils"

// The built-in fallback weeks, used when a property has no seasons
// configured (the original hardcoded behavior).
export const PEAK_WEEKS: number[] = [28, 29, 30]

export type WeekRange = { start: Temporal.PlainDate; end: Temporal.PlainDate }

export function peakWeekRange(year: number, week: number): WeekRange {
  const start = isoWeekMonday(year, week)
  return { start, end: start.add({ days: 6 }) }
}

export function formatDate(d: Temporal.PlainDate, locale: string): string {
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
  })
}

export function formatRange(r: WeekRange, locale: string): string {
  return `${formatDate(r.start, locale)} – ${formatDate(r.end, locale)}`
}

export function defaultYear(): number {
  const now = Temporal.Now.plainDateISO()
  return now.month >= 9 ? now.year + 1 : now.year
}

export type EligibleOwner = {
  user_group_id: number
  user_group_name: string
}

export type PriorityAssignment = {
  user_group_id: number
  iso_week: number
}

export type OwnerLookups = {
  ownersByWeek: Map<number, number[]>
  ownerNameById: Map<number, string>
  // group id → its assigned ISO weeks (inverse of ownersByWeek). A group can
  // hold one pick per season, so this is a list. Used by readers that bucket
  // items by group, e.g. PlannedMaintenanceSummary.
  weeksByGroup: Map<number, number[]>
}

export function buildOwnerLookups(
  eligibleOwners: readonly EligibleOwner[],
  assignments: readonly PriorityAssignment[],
): OwnerLookups {
  const ownersByWeek = new Map<number, number[]>()
  const weeksByGroup = new Map<number, number[]>()
  for (const a of assignments) {
    const weeks = weeksByGroup.get(a.user_group_id) ?? []
    weeks.push(a.iso_week)
    weeksByGroup.set(a.user_group_id, weeks)
    const list = ownersByWeek.get(a.iso_week) ?? []
    list.push(a.user_group_id)
    ownersByWeek.set(a.iso_week, list)
  }

  const ownerNameById = new Map<number, string>()
  for (const o of eligibleOwners) {
    ownerNameById.set(o.user_group_id, o.user_group_name)
  }

  return { ownersByWeek, ownerNameById, weeksByGroup }
}
