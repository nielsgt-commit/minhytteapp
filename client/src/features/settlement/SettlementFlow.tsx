import { useSuspenseQuery } from "@tanstack/react-query"
import { ReviewSettlement } from "@/features/settlement/reviewsettlement/ReviewSettlement.tsx"
import { ReviewExpenses } from "@/features/expenses/reviewexpenses/ReviewExpenses.tsx"
import { ReviewBookingDays } from "@/features/settlement/reviewsettlement/ReviewBookingDays.tsx"
import { CreateSettlementFlow } from "@/features/settlement/createsettlement/CreateSettlementFlow.tsx"
import { ReviewSplitPolicy } from "@/features/settlement/reviewsplitpolicy/ReviewSplitPolicy.tsx"
import { SettlementPhaseStepper } from "@/features/settlement/SettlementPhaseStepper.tsx"
import { SettlementHeadsProgress } from "@/features/settlement/SettlementHeadsProgress.tsx"
import { SettlementProgressSummary } from "@/features/settlement/SettlementProgressSummary.tsx"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import {
  nextPhaseIn,
  prevPhaseIn,
  requiredPhases,
} from "@/features/settlement/phase"
import { normalizeParameters } from "@server/shared/splitPolicy.ts"
import { useTRPC } from "@/trpc/trpc"

export function SettlementFlow({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: policies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const openSettlement = settlements.find(s => s.status === "open") ?? null

  if (!openSettlement) {
    return (
      <QueryBoundary>
        <CreateSettlementFlow
          propertyId={propertyId}
          isHead={me.head_property_ids.includes(propertyId)}
        />
      </QueryBoundary>
    )
  }

  const phase = openSettlement.phase
  const settlementId = openSettlement.id

  // A missing policy (built-in occupancy or deleted) means every phase, same
  // as the server's resolveSettlementParameters.
  const policy =
    openSettlement.split_policy_id == null
      ? undefined
      : policies.find(p => p.id === openSettlement.split_policy_id)
  const parameters = normalizeParameters(policy?.config.parameters)
  const phases = requiredPhases(parameters)
  const next = nextPhaseIn(phases, phase)
  const prev = prevPhaseIn(phases, phase)
  const stepNumber = phases.indexOf(phase) + 1

  return (
    <>
      <SettlementPhaseStepper phases={phases} phase={phase} />
      <SettlementHeadsProgress settlementId={settlementId} phase={phase} />
      <SettlementProgressSummary settlementId={settlementId} phase={phase} />
      {phase === "collecting_expenses" && (
        <ReviewExpenses settlementId={settlementId} phase={phase} next={next} />
      )}
      {phase === "collecting_bookings" && (
        <ReviewBookingDays
          settlementId={settlementId}
          phase={phase}
          next={next}
          prev={prev}
          stepNumber={stepNumber}
        />
      )}
      {phase === "reviewing" && (
        <ReviewSettlement
          settlementId={settlementId}
          phase={phase}
          next={next}
          prev={prev}
          stepNumber={stepNumber}
        />
      )}
      {phase === "split_policy" && (
        <ReviewSplitPolicy
          settlementId={settlementId}
          prev={prev}
          stepNumber={stepNumber}
        />
      )}
    </>
  )
}
