import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ReviewSettlement.module.css"
import expenseRowStyles from "./SettlementExpenseRow.module.css"
import { SettlementExpenseRow } from "./SettlementExpenseRow"
import { useHeadVisibility } from "./useHeadVisibility"
import {
  type ExpenseRow,
  useReviewSettlementData,
} from "./useReviewSettlementData"
import { useTRPC } from "@/trpc/trpc"
import {
  NEXT_PHASE,
  PREV_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase"

function sortExpenses(expenses: ExpenseRow[]) {
  return expenses.slice().sort((a, b) => a.date.localeCompare(b.date))
}

type Props = {
  settlementId: number
  phase: SettlementPhase
}

export function ReviewSettlement({ settlementId, phase }: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [showWaiting, setShowWaiting] = useState(false)
  const { heads, reimbursed, editableHeadId, invalidate } =
    useReviewSettlementData(settlementId)
  const { visibleIds } = useHeadVisibility()

  const updateProgress = useMutation(
    trpc.settlement.setMyReviewProgress.mutationOptions({
      onSuccess: invalidate,
    }),
  )

  const advancePhase = useMutation(
    trpc.settlement.advancePhase.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })
      },
    }),
  )

  const regressPhase = useMutation(
    trpc.settlement.regressPhase.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })
      },
    }),
  )

  if (heads.length === 0) {
    return <p>{t("No heads found.")}</p>
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

  const onProgressToggle = (checked: boolean) => {
    setShowWaiting(false)
    updateProgress.mutate({ id: settlementId, done: !checked })
  }

  const onContinueClick = () => {
    if (!allHeadsDone) {
      setShowWaiting(true)
      return
    }
    const nextPhase = NEXT_PHASE.reviewing
    if (nextPhase == null) return
    advancePhase.mutate({
      id: settlementId,
      from: "reviewing",
      to: nextPhase,
    })
  }

  const next = NEXT_PHASE.reviewing
  const prev = PREV_PHASE.reviewing

  return (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm">
          {t("Review settlement")}
        </Heading>
        <Switch
          label={t("Still reviewing")}
          position="end"
          data-size="sm"
          checked={stillReviewing}
          disabled={updateProgress.isPending}
          onChange={e => {
            onProgressToggle(e.target.checked)
          }}
        />
      </div>

      {expensesToShow.length === 0 ? (
        <Paragraph>{t("No reimbursed expenses.")}</Paragraph>
      ) : (
        <ul className={expenseRowStyles.list}>
          {expensesToShow.map(e => (
            <li key={e.id}>
              <SettlementExpenseRow
                expense={e}
                editable={effectiveHeadId(e) === editableHeadId}
                openSettlementId={settlementId}
                onSaved={invalidate}
              />
            </li>
          ))}
        </ul>
      )}
      {phase === "reviewing" && (
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
          {!stillReviewing && next != null && (
            <Button
              type="button"
              data-size="sm"
              disabled={advancePhase.isPending}
              onClick={onContinueClick}
            >
              {t("Progress to split policy")}
            </Button>
          )}
        </div>
      )}
      {showWaiting && pendingOthers.length > 0 && (
        <Paragraph role="alert" data-size="sm">
          {t("Waiting for {{names}} to complete the settlement.", {
            names: pendingOthers.map(h => h.name).join(", "),
          })}
        </Paragraph>
      )}
      {advancePhase.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: advancePhase.error.message })}
        </p>
      )}
      {regressPhase.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: regressPhase.error.message })}
        </p>
      )}
      {updateProgress.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: updateProgress.error.message })}
        </p>
      )}
    </>
  )
}
