import { useState } from "react"
import {
  Button,
  Dialog,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import styles from "./ReviewSettlement.module.css"
import expenseRowStyles from "./SettlementExpenseRow.module.css"
import { SettlementExpenseRow } from "./SettlementExpenseRow"
import { useHeadVisibility } from "./useHeadVisibility"
import {
  type ExpenseRow,
  useReviewSettlementData,
} from "./useReviewSettlementData"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { type SettlementPhase } from "@server/shared/splitPolicy.ts"
import { SettlementHeadsProgress } from "@/features/settlement/SettlementHeadsProgress.tsx"
import { StepBadge } from "@/components/shared/StepBadge.tsx"
import stepStyles from "@/components/shared/StepBadge.module.css"

function sortExpenses(expenses: ExpenseRow[]) {
  return expenses
    .slice()
    .sort((a, b) => Temporal.PlainDate.compare(a.date, b.date))
}

type Props = {
  settlementId: number
  phase: SettlementPhase
  next: SettlementPhase | null
  prev: SettlementPhase | null
  stepNumber: number
}

export function ReviewSettlement({
  settlementId,
  phase,
  next,
  prev,
  stepNumber,
}: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const [confirming, setConfirming] = useState(false)
  const { heads, reimbursed, editableHeadId } =
    useReviewSettlementData(settlementId)
  const { visibleIds } = useHeadVisibility()

  const updateProgress = useMutationWithInvalidation(
    trpc.settlement.setMyReviewProgress.mutationOptions(),
    [trpc.expense.pathKey(), trpc.user.pathKey(), trpc.settlement.pathKey()],
  )

  const advancePhase = useMutationWithInvalidation(
    trpc.settlement.advancePhase.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const regressPhase = useMutationWithInvalidation(
    trpc.settlement.regressPhase.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const status = useMutationsStatus(updateProgress, advancePhase, regressPhase)

  if (heads.length === 0) {
    return <EmptyState title={t("No heads found.")} />
  }

  const myHead = heads.find(h => h.id === editableHeadId)
  const myReviewDone = myHead?.review_done ?? false
  const stillReviewing = !myReviewDone

  const otherHeads = heads.filter(h => h.id !== editableHeadId)
  const displayedHeads =
    editableHeadId == null
      ? heads
      : heads.filter(h => h.id === editableHeadId || visibleIds.has(h.id))
  const displayedHeadIds = new Set(displayedHeads.map(h => h.id))
  const headIds = new Set(heads.map(h => h.id))
  const effectiveHeadId = (e: ExpenseRow): number | null =>
    e.reimbursed_by_id ?? (headIds.has(e.payer_id) ? e.payer_id : null)
  const expensesToShow = sortExpenses(
    reimbursed.filter(e => {
      const headId = effectiveHeadId(e)
      return headId != null && displayedHeadIds.has(headId)
    }),
  )

  const pendingOthers = otherHeads.filter(h => !h.review_done)
  const allHeadsDone = pendingOthers.length === 0 && myReviewDone
  const iAmHead = editableHeadId != null

  return (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm" className={stepStyles.stepHeading}>
          <StepBadge number={stepNumber} state="active" />
          {t("Review settlement")}
        </Heading>
      </div>

      {/* Once the head marks their review done, the expense list steps aside
          and the heads-progress panel becomes the view; Resume reviewing
          brings the list back. */}
      {!(iAmHead && myReviewDone) && (
        <>
          <Paragraph data-size="sm">
            {t(
              "This is where each household head decides what stays in the final settlement. Go over the approved expenses and mark your review as done — the settlement moves on once every head has finished.",
            )}
          </Paragraph>
          {expensesToShow.length === 0 ? (
            <EmptyState title={t("No reimbursed expenses.")} />
          ) : (
            <ul className={expenseRowStyles.list}>
              {expensesToShow.map(e => (
                <li key={e.id}>
                  <SettlementExpenseRow
                    expense={e}
                    editable={effectiveHeadId(e) === editableHeadId}
                    openSettlementId={settlementId}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {phase === "reviewing" && (
        <>
          {iAmHead && myReviewDone && !allHeadsDone && (
            <Paragraph data-size="sm">
              {t(
                "Your review is done — waiting for the other heads to finish.",
              )}
            </Paragraph>
          )}
          {(!iAmHead || myReviewDone) && (
            <SettlementHeadsProgress
              settlementId={settlementId}
              phase={phase}
            />
          )}
          <div className={styles.footer}>
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={regressPhase.isPending || prev == null}
              onClick={() => {
                if (prev == null) return
                regressPhase.mutate({
                  id: settlementId,
                  from: "reviewing",
                  to: prev,
                })
              }}
            >
              {t("Back")}
            </Button>
            {iAmHead && stillReviewing && (
              <Button
                type="button"
                data-size="sm"
                disabled={updateProgress.isPending}
                onClick={() => {
                  updateProgress.mutate({ id: settlementId, done: true })
                }}
              >
                {t("Mark review as done")}
              </Button>
            )}
            {iAmHead && myReviewDone && (
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                disabled={updateProgress.isPending}
                onClick={() => {
                  updateProgress.mutate({ id: settlementId, done: false })
                }}
              >
                {t("Resume reviewing")}
              </Button>
            )}
            {iAmHead && allHeadsDone && next != null && (
              <>
                <Button
                  type="button"
                  data-size="sm"
                  disabled={advancePhase.isPending}
                  onClick={() => {
                    setConfirming(true)
                  }}
                >
                  {t("Progress to split policy")}
                </Button>
                <Dialog
                  open={confirming}
                  onClose={() => {
                    setConfirming(false)
                  }}
                >
                  <Dialog.Block>
                    <Heading level={3} data-size="xs">
                      {t("Close the review?")}
                    </Heading>
                  </Dialog.Block>
                  <Dialog.Block>
                    <Paragraph data-size="sm">
                      {t(
                        "Continuing finishes the review for this period — the expenses in the settlement are locked while the heads accept the split. If something needs another look, it can be reopened with the Back button on the next step.",
                      )}
                    </Paragraph>
                  </Dialog.Block>
                  <Dialog.Block>
                    <div className={styles.footer}>
                      <Button
                        type="button"
                        variant="tertiary"
                        data-size="sm"
                        disabled={advancePhase.isPending}
                        onClick={() => {
                          setConfirming(false)
                        }}
                      >
                        {t("Cancel")}
                      </Button>
                      <Button
                        type="button"
                        data-size="sm"
                        disabled={advancePhase.isPending}
                        onClick={() => {
                          advancePhase.mutate({
                            id: settlementId,
                            from: "reviewing",
                            to: next,
                          })
                        }}
                      >
                        {t("Close the review and continue")}
                      </Button>
                    </div>
                    <ErrorAlert error={advancePhase.error} />
                  </Dialog.Block>
                </Dialog>
              </>
            )}
          </div>
        </>
      )}
      {!confirming && <ErrorAlert error={status.error} />}
    </>
  )
}
