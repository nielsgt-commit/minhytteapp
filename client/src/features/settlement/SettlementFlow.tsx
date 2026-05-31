import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ReviewSettlement } from "@/features/settlement/reviewsettlement/ReviewSettlement.tsx"
import { ReviewExpenses } from "@/features/expenses/reviewexpenses/ReviewExpenses.tsx"
import { ReviewBookingDays } from "@/features/settlement/reviewsettlement/ReviewBookingDays.tsx"
import { CreateSettlementFlow } from "@/features/settlement/createsettlement/CreateSettlementFlow.tsx"
import { ReviewSplitPolicy } from "@/features/settlement/reviewsplitpolicy/ReviewSplitPolicy.tsx"
import { SettlementPhaseStepper } from "@/features/settlement/SettlementPhaseStepper.tsx"
import { SettlementProgressSummary } from "@/features/settlement/SettlementProgressSummary.tsx"
import { useTRPC } from "@/trpc/trpc"

export function SettlementFlow({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())

  const openSettlement = settlements.find(s => s.status === "open") ?? null

  if (!openSettlement) {
    return (
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <CreateSettlementFlow
          propertyId={propertyId}
          isHead={me.is_admin || me.head_property_ids.includes(propertyId)}
        />
      </Suspense>
    )
  }

  const phase = openSettlement.phase
  const settlementId = openSettlement.id

  return (
    <>
      <SettlementPhaseStepper phase={phase} />
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
