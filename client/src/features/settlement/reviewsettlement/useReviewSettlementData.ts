import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

export type Status = "draft" | "submitted" | "reimbursed" | "rejected"
export type ExpenseType =
  | "food"
  | "gas"
  | "maintenance"
  | "capex"
  | "opex"
  | "fixed"
export type Progress = "in_progress" | "all_done"

export type ExpenseRow = {
  id: number
  property_id: number | null
  description: string
  amount: number
  payer_id: number
  payer_name: string | null
  reimbursed_by_id: number | null
  booking_id: number | null
  maintenance_id: number | null
  settlement_id: number | null
  date: string
  status: Status
  receipt_url: string | null
  expense_types: ExpenseType[]
}

// Inclusive: Jul 6 -> Jul 12 = 7 days. For nights, drop the `+ 1`.
function inclusiveDayCount(startIso: string, endIso: string) {
  const s = Date.parse(`${startIso}T00:00:00Z`)
  const e = Date.parse(`${endIso}T00:00:00Z`)
  return Math.round((e - s) / 86400000) + 1
}

export function useReviewSettlementData(settlementId: number) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0

  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: adjustments } = useSuspenseQuery(
    trpc.settlement.getBookingAdjustments.queryOptions({ settlementId }),
  )

  const excludedBookingIds = new Set(
    adjustments.filter(a => a.excluded).map(a => a.booking_id),
  )
  const extraOccupants = new Map<number, string[]>(
    adjustments
      .filter(a => a.extra_names.length > 0)
      .map(a => [a.booking_id, a.extra_names]),
  )

  const heads = users.filter(u => u.is_head)
  const reimbursed = expenses.filter(
    e => e.status === "reimbursed" && e.reimbursed_by_id != null,
  ) as ExpenseRow[]
  const editableHeadId = me?.is_head ? me.id : null

  const mainGroupForHead = (headId: number) =>
    groups.find(
      g => g.is_main && g.members.some(m => m.user_id === headId),
    )

  const mainGroupForUser = (userId: number) =>
    groups.find(
      g => g.is_main && g.members.some(m => m.user_id === userId),
    )

  const groupBookingDays = (memberIds: Set<number>) =>
    bookings
      .filter(b => b.status !== "cancelled" && !excludedBookingIds.has(b.id))
      .reduce((sum, b) => {
        const days = inclusiveDayCount(b.start_date, b.end_date)
        const occupantHits = b.occupants.filter(o =>
          memberIds.has(o.user_id),
        ).length
        const bookerGroup = mainGroupForUser(b.booker_id)
        const bookerInGroup =
          bookerGroup != null
          && bookerGroup.members.some(m => memberIds.has(m.user_id))
        const extraHits = bookerInGroup
          ? (extraOccupants.get(b.id)?.length ?? 0)
          : 0
        const totalHits = occupantHits + extraHits
        if (totalHits === 0) return sum
        return sum + totalHits * days
      }, 0)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.expense.pathKey() })
    void qc.invalidateQueries({ queryKey: trpc.user.pathKey() })
  }

  return {
    heads,
    reimbursed,
    editableHeadId,
    mainGroupForHead,
    groupBookingDays,
    invalidate,
  }
}

export type HeadUser = ReturnType<typeof useReviewSettlementData>["heads"][number]
