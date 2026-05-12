import { Suspense, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { ReviewSettlement } from "@/features/settlement/reviewsettlement/ReviewSettlement.tsx"
import { ReviewExpenses } from "@/features/expenses/ReviewExpenses.tsx"
import { ReviewBookingDays } from "@/features/settlement/reviewsettlement/ReviewBookingDays.tsx"
import { ClosedSettlementSummary } from "@/features/settlement/ClosedSettlementSummary.tsx"
import { ReviewSplitPolicy } from "@/features/settlement/reviewsplitpolicy/ReviewSplitPolicy.tsx"
import { SettlementProgressSummary } from "@/features/settlement/SettlementProgressSummary.tsx"
import { SettlementTestForm } from "@/features/settlement/testform/SettlementTestForm.tsx"
import { useTRPC } from "@/trpc/trpc"

export function SettlementFlow({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const [showClosed, setShowClosed] = useState(false)

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())

  const openSettlement = settlements.find(s => s.status === "open") ?? null
  const closedSettlements = settlements
    .filter(s => s.status === "closed")
    .sort((a, b) => {
      const aClosed = a.closed_at ? new Date(a.closed_at).getTime() : 0
      const bClosed = b.closed_at ? new Date(b.closed_at).getTime() : 0
      if (aClosed !== bClosed) return bClosed - aClosed
      return b.year - a.year
    })
  if (!openSettlement) {
    return (
      <>
        {me?.is_head && (
          <Card asChild>
            <article>
              <Card.Block data-size="sm">
                <Heading level={3} data-size="xs">Start a new settlement</Heading>
                <Paragraph data-size="sm">
                  Pick an existing split policy from the dropdown, or scroll
                  down to build a new one before you submit.
                </Paragraph>
              </Card.Block>
              <Card.Block data-size="sm">
                <Suspense fallback={<p>Loading form…</p>}>
                  <SettlementTestForm />
                </Suspense>
              </Card.Block>
            </article>
          </Card>
        )}
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={() => { setShowClosed(v => !v) }}
        >
          {showClosed ? "Hide closed settlements" : "Show closed settlements"}
        </Button>
        {showClosed && (
          closedSettlements.length === 0 ? (
            <Paragraph data-size="sm">No closed settlements yet.</Paragraph>
          ) : (
            closedSettlements.map(s => (
              <Suspense
                key={s.id}
                fallback={<p>Loading closed settlement…</p>}
              >
                <ClosedSettlementSummary settlementId={s.id} />
              </Suspense>
            ))
          )
        )}
      </>
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
