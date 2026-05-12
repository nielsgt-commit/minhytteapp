import { useState } from "react"
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react"
import styles from "./ReviewSettlement.module.css"
import expenseRowStyles from "./SettlementExpenseRow.module.css"
import { SettlementExpenseRow } from "./SettlementExpenseRow"
import { useHeadVisibility } from "./useHeadVisibility"
import {
  type ExpenseRow,
  type Progress,
  useReviewSettlementData,
} from "./useReviewSettlementData"
import { useTRPC } from "@/trpc/trpc"
import { SettlementHeadVisibility } from "@/features/settlement/SettlementHeadVisibility.tsx"
import {
  NEXT_PHASE,
  PREV_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase"

function sortExpenses(expenses: ExpenseRow[]) {
  return expenses.slice().sort((a, b) => {
    const aFixed = a.expense_types.includes("fixed") ? 0 : 1
    const bFixed = b.expense_types.includes("fixed") ? 0 : 1
    if (aFixed !== bFixed) return aFixed - bFixed
    return a.date.localeCompare(b.date)
  })
}

type Props = {
  settlementId: number
  phase: SettlementPhase
}

export function ReviewSettlement({ settlementId, phase }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [showWaiting, setShowWaiting] = useState(false)
  const {
    heads,
    reimbursed,
    editableHeadId,
    invalidate,
  } = useReviewSettlementData(settlementId)
  const { visibleIds, toggle } = useHeadVisibility()

  const updateProgress = useMutation(
    trpc.user.updateMySettlementProgress.mutationOptions({
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
    return <p>No heads found.</p>
  }

  const myHead = heads.find(h => h.id === editableHeadId)
  const myProgress: Progress =
    (myHead?.settlement_progress as Progress | null | undefined)
    ?? "in_progress"
  const stillReviewing = myProgress !== "all_done"

  const otherHeads = heads.filter(h => h.id !== editableHeadId)
  const displayedHeads =
    editableHeadId == null
      ? heads
      : heads.filter(
        h => h.id === editableHeadId || visibleIds.has(h.id),
      )
  const displayedHeadIds = new Set(displayedHeads.map(h => h.id))
  const expensesToShow = sortExpenses(
    reimbursed.filter(
      e =>
        e.reimbursed_by_id != null
        && displayedHeadIds.has(e.reimbursed_by_id),
    ),
  )

  const pendingOthers = otherHeads.filter(
    h => h.settlement_progress !== "all_done",
  )
  const allHeadsDone =
    pendingOthers.length === 0 && myProgress === "all_done"

  const onProgressToggle = (checked: boolean) => {
    setShowWaiting(false)
    const nextProgress: Progress = checked ? "in_progress" : "all_done"
    updateProgress.mutate({ settlement_progress: nextProgress })
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
        <Heading level={4} data-size="sm">Review settlement</Heading>
        <Switch
          label="Still reviewing"
          position="end"
          data-size="sm"
          checked={stillReviewing}
          disabled={updateProgress.isPending}
          onChange={e => { onProgressToggle(e.target.checked) }}
        />
      </div>

      {expensesToShow.length === 0 ? (
        <Paragraph>No reimbursed expenses.</Paragraph>
      ) : (
        <ul className={expenseRowStyles.list}>
          {expensesToShow.map(e => (
            <li key={e.id}>
              <SettlementExpenseRow
                expense={e}
                editable={e.reimbursed_by_id === editableHeadId}
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
            Back
          </Button>
          {!stillReviewing && next != null && (
            <Button
              type="button"
              data-size="sm"
              disabled={advancePhase.isPending}
              onClick={onContinueClick}
            >
              Progress to split policy
            </Button>
          )}
        </div>
      )}
      {showWaiting && pendingOthers.length > 0 && (
        <Paragraph role="alert" data-size="sm">
          Waiting for {pendingOthers.map(h => h.name).join(", ")} to complete
          the settlement.
        </Paragraph>
      )}
      {advancePhase.error && (
        <p role="alert">Error: {advancePhase.error.message}</p>
      )}
      {regressPhase.error && (
        <p role="alert">Error: {regressPhase.error.message}</p>
      )}
      {updateProgress.error && (
        <p role="alert">Error: {updateProgress.error.message}</p>
      )}
    </>
  )
}
