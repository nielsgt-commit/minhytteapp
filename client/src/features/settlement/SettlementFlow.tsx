import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ReviewSettlement } from "@/features/settlement/reviewsettlement/ReviewSettlement.tsx"
import { ReviewExpenses } from "@/features/expenses/ReviewExpenses.tsx"
import { ReviewBookingDays } from "@/features/settlement/reviewsettlement/ReviewBookingDays.tsx"
import { CreateSettlementFlow } from "@/features/settlement/createsettlement/CreateSettlementFlow.tsx"
import { ReviewSplitPolicy } from "@/features/settlement/reviewsplitpolicy/ReviewSplitPolicy.tsx"
import { SettlementProgressSummary } from "@/features/settlement/SettlementProgressSummary.tsx"
import { useTRPC } from "@/trpc/trpc"

export function SettlementFlow({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())

  const openSettlement = settlements.find(s => s.status === "open") ?? null

  if (!openSettlement) {
    return (
      <Suspense fallback={<p>Loading…</p>}>
        <CreateSettlementFlow
          propertyId={propertyId}
          isHead={me?.is_head ?? false}
        />
      </Suspense>
    )
  }

  const phase = openSettlement.phase
  const settlementId = openSettlement.id

  return (
    <>
      <SettlementProgressSummary settlementId={settlementId} phase={phase} />
      {phase === "collecting_expenses" && (
        <ReviewExpenses settlementId={settlementId} phase={phase} />
      )}
      {phase === "collecting_bookings" && (
        <ReviewBookingDays settlementId={settlementId} phase={phase} />
      )}
      {phase === "reviewing" && (
        <ReviewSettlement settlementId={settlementId} phase={phase} />
      )}
      {phase === "split_policy" && (
        <ReviewSplitPolicy settlementId={settlementId} />
      )}
    </>
  )
}
