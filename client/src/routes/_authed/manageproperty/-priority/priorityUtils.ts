import { Temporal } from "temporal-polyfill"
import { isoWeekMonday } from "@/utils/dateUtils"

export type PeakWeek = 28 | 29 | 30
export const PEAK_WEEKS: PeakWeek[] = [28, 29, 30]

export type WeekRange = { start: Temporal.PlainDate; end: Temporal.PlainDate }

export function peakWeekRange(year: number, week: PeakWeek): WeekRange {
  const start = isoWeekMonday(year, week)
  return { start, end: start.add({ days: 6 }) }
}

export function formatDate(d: Temporal.PlainDate): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function formatRange(r: WeekRange): string {
  return `${formatDate(r.start)} – ${formatDate(r.end)}`
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
  ownersByWeek: Map<PeakWeek, number[]>
  ownerNameById: Map<number, string>
}

export function buildOwnerLookups(
  eligibleOwners: readonly EligibleOwner[],
  assignments: readonly PriorityAssignment[],
): OwnerLookups {
  const ownersByWeek = new Map<PeakWeek, number[]>()
  for (const a of assignments) {
    if (a.iso_week === 28 || a.iso_week === 29 || a.iso_week === 30) {
      const list = ownersByWeek.get(a.iso_week) ?? []
      list.push(a.user_group_id)
      ownersByWeek.set(a.iso_week, list)
    }
  }

  const ownerNameById = new Map<number, string>()
  for (const o of eligibleOwners) {
    ownerNameById.set(o.user_group_id, o.user_group_name)
  }

  return { ownersByWeek, ownerNameById }
}
