import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { Temporal } from "temporal-polyfill"
import { isoWeekMonday } from "@/utils/dateUtils"
import type { BookingDraft } from "@/features/planstay/booking-logic"

export type OverlappingPriorityWeek = { iso_week: number; owner_name: string }

/**
 * Priority-week assignments that overlap the draft's date range, with the
 * owning group's name resolved. Fetches the priority list for the draft's
 * start year (only once both dates are picked).
 */
export function useOverlappingPriorityWeeks(
  propertyId: number,
  draft: Pick<BookingDraft, "start_date" | "end_date">,
): OverlappingPriorityWeek[] {
  const trpc = useTRPC()

  const draftYear = draft.start_date
    ? parseInt(draft.start_date.slice(0, 4))
    : Temporal.Now.plainDateISO().year
  const { data: priorityData } = useQuery({
    ...trpc.priority.list.queryOptions({
      property_id: propertyId,
      year: draftYear,
    }),
    enabled: draft.start_date != null && draft.end_date != null,
  })

  const startDate = draft.start_date
  const endDate = draft.end_date
  return useMemo(() => {
    if (!startDate || !endDate || !priorityData) return []
    const ownerNameById = new Map(
      priorityData.eligibleOwners.map(o => [
        o.user_group_id,
        o.user_group_name,
      ]),
    )
    return priorityData.assignments
      .filter(a => {
        const weekStart = isoWeekMonday(a.year, a.iso_week)
        const weekEnd = weekStart.add({ days: 6 })
        // The draft keeps ISO "YYYY-MM-DD" strings, which compare correctly
        // against PlainDate.toString() lexicographically.
        return (
          weekStart.toString() <= endDate && weekEnd.toString() >= startDate
        )
      })
      .map(a => ({
        iso_week: a.iso_week,
        owner_name:
          ownerNameById.get(a.user_group_id) ?? `#${String(a.user_group_id)}`,
      }))
  }, [startDate, endDate, priorityData])
}
