import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Paragraph } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { type SettlementPhase } from "@/features/settlement/phase"
import { PHASE_LABELS } from "@/features/settlement/SettlementPhaseStepper.tsx"
import { useTRPC } from "@/trpc/trpc"

export function SettlementProgressSummary({
  settlementId,
  phase,
}: {
  settlementId: number
  phase: SettlementPhase
}) {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const propertyId = selectedPropertyId ?? 0

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: policies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const openSettlement = settlements.find(s => s.id === settlementId)
  const openYear = openSettlement?.year ?? null
  const createdByName = openSettlement?.created_by_name ?? null
  const activePolicy = openSettlement?.split_policy_id != null
    ? policies.find(p => p.id === openSettlement.split_policy_id) ?? null
    : null
  const splitPolicyName = activePolicy?.name ?? openSettlement?.split_policy ?? null

  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Paragraph data-size="sm">
            <strong>{openYear ?? "—"}</strong>
            {" · Created by "}
            <strong>{createdByName ?? "—"}</strong>
            {" · Split policy: "}
            <strong>{splitPolicyName ?? "—"}</strong>
            {" · Status: "}
            <strong>{PHASE_LABELS[phase]}</strong>
          </Paragraph>
        </Card.Block>
      </article>
    </Card>
  )
}
