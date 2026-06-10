import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { currentYear, isoWeekMonday } from "@/utils/dateUtils"
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
    : currentYear()
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
        // isoWeekMonday returns UTC-midnight Dates, so slicing the UTC ISO
        // string (not local-time toIso) yields the intended calendar day.
        const weekStart = isoWeekMonday(a.year, a.iso_week)
        const weekEnd = new Date(weekStart)
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
        return (
          weekStart.toISOString().slice(0, 10) <= endDate &&
          weekEnd.toISOString().slice(0, 10) >= startDate
        )
      })
      .map(a => ({
        iso_week: a.iso_week,
        owner_name:
          ownerNameById.get(a.user_group_id) ?? `#${String(a.user_group_id)}`,
      }))
  }, [startDate, endDate, priorityData])
}
