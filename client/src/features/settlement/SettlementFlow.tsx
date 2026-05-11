import { Suspense } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button } from "@digdir/designsystemet-react"
import { ReviewSettlement } from "@/features/settlement/reviewsettlement/ReviewSettlement.tsx"
import { ReviewExpenses } from "@/features/expenses/ReviewExpenses.tsx"
import { ReviewBookingDays } from "@/features/settlement/reviewsettlement/ReviewBookingDays.tsx"
import { ClosedSettlementSummary } from "@/features/settlement/ClosedSettlementSummary.tsx"
import { ReviewSplitPolicy } from "@/features/settlement/ReviewSplitPolicy.tsx"
import { SettlementProgressSummary } from "@/features/settlement/SettlementProgressSummary.tsx"
import { type SettlementPhase } from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"

export function SettlementFlow({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const openSettlement = settlements.find(s => s.status === "open") ?? null
  const recentClosedSettlement = settlements
    .filter(s => s.status === "closed")
    .sort((a, b) => {
      const aClosed = a.closed_at ? new Date(a.closed_at).getTime() : 0
      const bClosed = b.closed_at ? new Date(b.closed_at).getTime() : 0
      if (aClosed !== bClosed) return bClosed - aClosed
      return b.year - a.year
    })[0] ?? null

  const createSettlement = useMutation(
    trpc.settlement.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })
      },
    }),
  )

  if (!openSettlement) {
    return (
      <>
        <Button
          type="button"
          onClick={() => {
            createSettlement.mutate({
              property_id: propertyId,
              year: new Date().getFullYear(),
              status: "open",
              split_policy: "occupancy_days",
            })
          }}
          disabled={createSettlement.isPending}
        >
          + Add new settlement
        </Button>
        {createSettlement.error && (
          <p role="alert">Error: {createSettlement.error.message}</p>
        )}
        {recentClosedSettlement && (
          <Suspense fallback={<p>Loading closed settlement…</p>}>
            <ClosedSettlementSummary
              settlementId={recentClosedSettlement.id}
            />
          </Suspense>
        )}
      </>
    )
  }

  const phase = openSettlement.phase as SettlementPhase
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
        <Suspense fallback={<p>Loading split preview…</p>}>
          <ReviewSplitPolicy settlementId={settlementId} />
        </Suspense>
      )}
      {recentClosedSettlement && (
        <Suspense fallback={<p>Loading closed settlement…</p>}>
          <ClosedSettlementSummary
            settlementId={recentClosedSettlement.id}
          />
        </Suspense>
      )}
    </>
  )
}
