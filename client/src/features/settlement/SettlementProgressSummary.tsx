import { useState } from "react"
import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Chip, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { type SettlementPhase } from "@/features/settlement/phase"
import { usePhaseLabels } from "@/features/settlement/SettlementPhaseStepper.tsx"
import { useTRPC } from "@/trpc/trpc"
import styles from "./SettlementProgressSummary.module.css"

export function SettlementProgressSummary({
  settlementId,
  phase,
}: {
  settlementId: number
  phase: SettlementPhase
}) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const PHASE_LABELS = usePhaseLabels()
  const [open, setOpen] = useState(false)
  const selectedPropertyId = useSelectedPropertyId()
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
  const activePolicy =
    openSettlement?.split_policy_id != null
      ? (policies.find(p => p.id === openSettlement.split_policy_id) ?? null)
      : null
  const splitPolicyName =
    activePolicy?.name ?? openSettlement?.split_policy ?? null

  return (
    <div className={styles.summary}>
      <Chip.Button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(o => !o)
        }}
      >
        {openYear ?? "—"}
      </Chip.Button>
      {open && (
        <Card asChild className={styles.card}>
          <article>
            <Card.Block data-size="sm">
              <Paragraph data-size="sm">
                {t("Created by ")}
                <strong>{createdByName ?? "—"}</strong>
                {t(" · Split policy: ")}
                <strong>{splitPolicyName ?? "—"}</strong>
                {t(" · Status: ")}
                <strong>{PHASE_LABELS[phase]}</strong>
              </Paragraph>
            </Card.Block>
          </article>
        </Card>
      )}
    </div>
  )
}
