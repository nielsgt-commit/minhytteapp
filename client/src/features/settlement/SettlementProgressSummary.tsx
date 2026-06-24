import { useState } from "react"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card, Chip, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { type SettlementPhase } from "@/features/settlement/phase"
import { usePhaseLabels } from "@/features/settlement/SettlementPhaseStepper.tsx"
import { SettlementSplitPolicyDetails } from "@/features/settlement/SettlementSplitPolicyDetails.tsx"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
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
  const [showPolicy, setShowPolicy] = useState(false)
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
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const deleteSettlement = useMutationWithInvalidation(
    trpc.settlement.delete.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const iAmHead = me.head_property_ids.includes(propertyId)
  // "Added for review" means an expense is either awaiting a head's review
  // (submitted) or has already been reimbursed into this settlement. When
  // neither exists in any group, the settlement is empty and safe to scrap.
  const hasReviewExpenses = expenses.some(
    e => e.status === "submitted" || e.settlement_id === settlementId,
  )
  const canDelete = iAmHead && !hasReviewExpenses

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
                {activePolicy != null ? (
                  <button
                    type="button"
                    className={styles.policyToggle}
                    aria-expanded={showPolicy}
                    onClick={() => {
                      setShowPolicy(s => !s)
                    }}
                  >
                    {splitPolicyName ?? "—"}
                  </button>
                ) : (
                  <strong>{splitPolicyName ?? "—"}</strong>
                )}
                {t(" · Status: ")}
                <strong>{PHASE_LABELS[phase]}</strong>
              </Paragraph>
            </Card.Block>
            {showPolicy && activePolicy != null && (
              <Card.Block data-size="sm">
                <SettlementSplitPolicyDetails
                  propertyId={propertyId}
                  policy={activePolicy}
                />
              </Card.Block>
            )}
            {canDelete && (
              <Card.Block data-size="sm">
                <Button
                  type="button"
                  variant="tertiary"
                  data-color="danger"
                  data-size="sm"
                  disabled={deleteSettlement.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        t(
                          "Delete this settlement and start over? No expenses have been added for review yet. This cannot be undone.",
                        ),
                      )
                    ) {
                      return
                    }
                    deleteSettlement.mutate({ id: settlementId })
                  }}
                >
                  {t("Delete settlement and start over")}
                </Button>
                <ErrorAlert error={deleteSettlement.error} />
              </Card.Block>
            )}
          </article>
        </Card>
      )}
    </div>
  )
}
