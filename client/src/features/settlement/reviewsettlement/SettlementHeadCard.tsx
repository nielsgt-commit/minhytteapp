import { SettlementExpenseRow } from "./SettlementExpenseRow"
import type {
  ExpenseRow,
  HeadUser,
  Progress,
} from "./useReviewSettlementData"

// Stub replacement — original file was untracked and lost.
// Renders enough to compile and exercise the review flow.

type Props = {
  head: HeadUser
  isMine: boolean
  expenses: ExpenseRow[]
  total: number
  bookingDaysLabel: string
  progress: Progress
  progressPending: boolean
  openSettlementId: number
  onToggleProgress: () => void
  onExpenseSaved: () => void
}

export function SettlementHeadCard({
  head,
  isMine,
  expenses,
  total,
  bookingDaysLabel,
  progress,
  progressPending,
  openSettlementId,
  onToggleProgress,
  onExpenseSaved,
}: Props) {
  return (
    <section>
      <h4>
        {head.name}
        {isMine ? " (you)" : ""}
      </h4>
      <p>{bookingDaysLabel}</p>
      <p>Total reimbursed: {String(total)},-</p>
      <p>
        Status:{" "}
        {progress === "all_done" ? "done" : "in progress"}
      </p>
      {isMine && (
        <button
          type="button"
          disabled={progressPending}
          onClick={onToggleProgress}
        >
          Mark as {progress === "in_progress" ? "done" : "in progress"}
        </button>
      )}
      {expenses.length === 0 ? (
        <p>No reimbursed expenses.</p>
      ) : (
        <ul>
          {expenses.map(e => (
            <li key={e.id}>
              <SettlementExpenseRow
                expense={e}
                editable={isMine}
                openSettlementId={openSettlementId}
                onSaved={onExpenseSaved}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
