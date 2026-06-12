import { useSelectedPropertyId } from "@/selection/useSelection"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import type { Temporal } from "temporal-polyfill"
import { useTRPC } from "@/trpc/trpc"
import { inclusiveDayCount } from "@/utils/dateUtils"

export type Status = "draft" | "submitted" | "reimbursed" | "rejected"
export type ExpenseType = "food" | "gas" | "maintenance"

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
  date: Temporal.PlainDate
  status: Status
  receipt_url: string | null
  expense_types: ExpenseType[]
}

export function useReviewSettlementData(settlementId: number) {
  const trpc = useTRPC()
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
  const { data: preview } = useQuery({
    ...trpc.settlement.previewSplit.queryOptions({ id: settlementId }),
    retry: false,
  })

  const reviewDoneHeadIds = new Set(
    (preview?.heads ?? []).filter(h => h.review_done).map(h => h.user_id),
  )

  const excludedBookingIds = new Set(
    adjustments.filter(a => a.excluded).map(a => a.booking_id),
  )
  const extraOccupants = new Map<number, string[]>(
    adjustments
      .filter(a => a.extra_names.length > 0)
      .map(a => [a.booking_id, a.extra_names]),
  )

  const heads = users
    .filter(u => u.is_head)
    .map(u => ({ ...u, review_done: reviewDoneHeadIds.has(u.id) }))
  const headIds = new Set(heads.map(h => h.id))
  const reimbursed = expenses.filter(e => {
    if (e.status === "reimbursed" && e.reimbursed_by_id != null) return true
    if (e.status === "submitted" && headIds.has(e.payer_id)) return true
    return false
  }) as ExpenseRow[]
  const iAmHead =
    me.is_admin ||
    (selectedPropertyId != null &&
      me.head_property_ids.includes(selectedPropertyId))
  const editableHeadId = iAmHead ? me.id : null

  const mainGroupForHead = (headId: number) =>
    groups.find(g => g.is_family && g.members.some(m => m.user_id === headId))

  const mainGroupForUser = (userId: number) =>
    groups.find(g => g.is_family && g.members.some(m => m.user_id === userId))

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
          bookerGroup?.members.some(m => memberIds.has(m.user_id)) ?? false
        const extraHits = bookerInGroup
          ? (extraOccupants.get(b.id)?.length ?? 0)
          : 0
        const totalHits = occupantHits + extraHits
        if (totalHits === 0) return sum
        return sum + totalHits * days
      }, 0)

  return {
    heads,
    reimbursed,
    editableHeadId,
    mainGroupForHead,
    groupBookingDays,
  }
}

export type HeadUser = ReturnType<
  typeof useReviewSettlementData
>["heads"][number]
