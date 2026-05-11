import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { Button } from "@digdir/designsystemet-react"
import styles from "./ReviewSettlement.module.css"
import { useTRPC } from "@/trpc/trpc"
import { SettlementHeadVisibility } from "@/features/settlement/SettlementHeadVisibility.tsx"
import {
  NEXT_PHASE,
  PREV_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase"
import { SettlementHeadCard } from "./SettlementHeadCard"
import { useHeadVisibility } from "./useHeadVisibility"
import {
  type ExpenseRow,
  type Progress,
  useReviewSettlementData,
} from "./useReviewSettlementData"

function sortedExpensesFor(headId: number, reimbursed: ExpenseRow[]) {
  return reimbursed
    .filter(e => e.reimbursed_by_id === headId)
    .slice()
    .sort((a, b) => {
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
  const {
    heads,
    reimbursed,
    editableHeadId,
    mainGroupForHead,
    groupBookingDays,
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

  const allHeadsDone = heads.every(
    h => h.settlement_progress === "all_done",
  )

  const otherHeads = heads.filter(h => h.id !== editableHeadId)
  const displayedHeads =
    editableHeadId == null
      ? heads
      : heads.filter(
        h => h.id === editableHeadId || visibleIds.has(h.id),
      )

  return (
    <>
      {editableHeadId != null && (
        <SettlementHeadVisibility
          others={otherHeads}
          visibleIds={visibleIds}
          onToggle={toggle}
        />
      )}
      <div className={styles.list}>
        {displayedHeads.map(h => {
          const expenses = sortedExpensesFor(h.id, reimbursed)
          const total = expenses.reduce((sum, e) => sum + e.amount, 0)
          const group = mainGroupForHead(h.id)
          const memberIds = new Set(group?.members.map(m => m.user_id) ?? [])
          const days = group ? groupBookingDays(memberIds) : 0
          const progress = h.settlement_progress as Progress
          const next: Progress =
            progress === "in_progress" ? "all_done" : "in_progress"
          return (
            <SettlementHeadCard
              key={h.id}
              head={h}
              isMine={editableHeadId === h.id}
              expenses={expenses}
              total={total}
              bookingDaysLabel={`${group?.name ?? "no group"} booking days: ${String(days)}`}
              progress={progress}
              progressPending={updateProgress.isPending}
              openSettlementId={settlementId}
              onToggleProgress={() => {
                updateProgress.mutate({ settlement_progress: next })
              }}
              onExpenseSaved={invalidate}
            />
          )
        })}
      </div>
      {phase === "reviewing" && (
        <>
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            disabled={regressPhase.isPending}
            onClick={() => {
              const prev = PREV_PHASE.reviewing
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
          <Button
            type="button"
            data-size="sm"
            disabled={!allHeadsDone || advancePhase.isPending}
            onClick={() => {
              const next = NEXT_PHASE.reviewing
              if (next == null) return
              advancePhase.mutate({
                id: settlementId,
                from: "reviewing",
                to: next,
              })
            }}
          >
            Progress to split policy
          </Button>
          {advancePhase.error && (
            <p role="alert">Error: {advancePhase.error.message}</p>
          )}
          {regressPhase.error && (
            <p role="alert">Error: {regressPhase.error.message}</p>
          )}
        </>
      )}
    </>
  )
}
