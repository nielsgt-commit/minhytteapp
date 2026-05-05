import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { SettlementHeadVisibility } from "@/features/settlement/SettlementHeadVisibility.tsx"

type Status = "draft" | "submitted" | "reimbursed" | "rejected"
type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"
type Progress = "in_progress" | "all_done"

// Inclusive: Jul 6 -> Jul 12 = 7 days. For nights, drop the `+ 1`.
function inclusiveDayCount(startIso: string, endIso: string) {
  const s = Date.parse(`${startIso}T00:00:00Z`)
  const e = Date.parse(`${endIso}T00:00:00Z`)
  return Math.round((e - s) / 86400000) + 1
}

type ExpenseRow = {
  id: number
  description: string
  amount: number
  payer_id: number
  payer_name: string | null
  reimbursed_by_id: number | null
  date: string
  status: Status
  receipt_url: string | null
  expense_types: ExpenseType[]
}

export function SettlementHeadColumns() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: expenses } = useSuspenseQuery(trpc.expense.list.queryOptions())
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.list.queryOptions(),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembers.queryOptions(),
  )

  const heads = users.filter(u => u.is_head)
  const reimbursed = expenses.filter(
    e => e.status === "reimbursed" && e.reimbursed_by_id != null,
  ) as ExpenseRow[]

  const mainGroupForHead = (headId: number) =>
    groups.find(
      g => g.is_main && g.members.some(m => m.user_id === headId),
    )

  const groupBookingDays = (memberIds: Set<number>) =>
    bookings
      .filter(b => b.status !== "cancelled")
      .reduce((sum, b) => {
        const occupantHits = b.occupants.filter(o =>
          memberIds.has(o.user_id),
        ).length
        if (occupantHits === 0) return sum
        return sum + occupantHits * inclusiveDayCount(b.start_date, b.end_date)
      }, 0)

  const editableHeadId = me?.is_head ? me.id : null

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: trpc.expense.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })
    void qc.invalidateQueries({ queryKey: trpc.user.me.queryKey() })
  }

  const updateProgress = useMutation(
    trpc.user.updateMySettlementProgress.mutationOptions({
      onSuccess: invalidate,
    }),
  )

  const [visibleOtherIds, setVisibleOtherIds] = useState<Set<number>>(
    () => new Set(),
  )

  if (heads.length === 0) {
    return <p>No heads found.</p>
  }

  const otherHeads = heads.filter(h => h.id !== editableHeadId)
  const displayedHeads =
    editableHeadId == null
      ? heads
      : heads.filter(
        h => h.id === editableHeadId || visibleOtherIds.has(h.id),
      )

  const toggleOther = (id: number) => {
    setVisibleOtherIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {editableHeadId != null && (
        <SettlementHeadVisibility
          others={otherHeads}
          visibleIds={visibleOtherIds}
          onToggle={toggleOther}
        />
      )}
      <table>
        <thead>
          <tr>
            {displayedHeads.map(h => (
            <th key={h.id} scope="col">
              {h.name}
              {editableHeadId === h.id ? " (you)" : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {displayedHeads.map(h => {
            const cellExpenses = reimbursed
              .filter(e => e.reimbursed_by_id === h.id)
              .slice()
              .sort((a, b) => {
                const aFixed = a.expense_types.includes("fixed") ? 0 : 1
                const bFixed = b.expense_types.includes("fixed") ? 0 : 1
                if (aFixed !== bFixed) return aFixed - bFixed
                return a.date.localeCompare(b.date)
              })
            return (
              <td key={h.id}>
                {cellExpenses.length === 0 ? (
                  <p>(no reimbursed expenses)</p>
                ) : (
                  <ul>
                    {cellExpenses.map(e => (
                      <li key={e.id}>
                        <ExpenseEditor
                          expense={e}
                          editable={editableHeadId === h.id}
                          onSaved={invalidate}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            )
          })}
        </tr>
      </tbody>
      <tfoot>
        <tr>
          {displayedHeads.map(h => {
            const total = reimbursed
              .filter(e => e.reimbursed_by_id === h.id)
              .reduce((sum, e) => sum + e.amount, 0)
            return (
              <td key={h.id}>
                <strong>Total: {total}</strong>
              </td>
            )
          })}
        </tr>
        <tr>
          {displayedHeads.map(h => {
            const group = mainGroupForHead(h.id)
            const memberIds = new Set(
              group?.members.map(m => m.user_id) ?? [],
            )
            const days = group ? groupBookingDays(memberIds) : 0
            const label = group?.name ?? "no group"
            return (
              <td key={h.id}>
                {label} booking days: {days}
              </td>
            )
          })}
        </tr>
        <tr>
          {displayedHeads.map(h => {
            const isMine = editableHeadId === h.id
            const progress = h.settlement_progress as Progress
            const next: Progress =
              progress === "in_progress" ? "all_done" : "in_progress"
            return (
              <td key={h.id}>
                <button
                  type="button"
                  disabled={!isMine || updateProgress.isPending}
                  onClick={() => {
                    updateProgress.mutate({ settlement_progress: next })
                  }}
                >
                  {progress === "in_progress" ? "in progress" : "all done"}
                </button>
              </td>
            )
          })}
        </tr>
      </tfoot>
    </table>
    </>
  )
}

function ExpenseEditor({
  expense,
  editable,
  onSaved,
}: {
  expense: ExpenseRow
  editable: boolean
  onSaved: () => void
}) {
  const trpc = useTRPC()
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [date, setDate] = useState(expense.date)

  const updateExpense = useMutation(
    trpc.expense.update.mutationOptions({
      onSuccess: () => {
        onSaved()
      },
    }),
  )

  const dirty =
    description !== expense.description ||
    amount !== String(expense.amount) ||
    date !== expense.date

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (expense.reimbursed_by_id == null) return
    updateExpense.mutate({
      id: expense.id,
      description,
      amount: Number(amount),
      reimbursed_by_id: expense.reimbursed_by_id,
      date,
      status: expense.status,
      receipt_url: expense.receipt_url,
      expense_types: expense.expense_types,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Description
          <input
            type="text"
            value={description}
            disabled={!editable}
            onChange={e => {
              setDescription(e.target.value)
            }}
          />
        </label>
      </div>
      <div>
        <label>
          Amount
          <input
            type="number"
            step={1}
            value={amount}
            disabled={!editable}
            onChange={e => {
              setAmount(e.target.value)
            }}
          />
        </label>
      </div>
      <div>
        <label>
          Date
          <input
            type="date"
            value={date}
            disabled={!editable}
            onChange={e => {
              setDate(e.target.value)
            }}
          />
        </label>
      </div>
      <div>
        Paid by: {expense.payer_name ?? `#${String(expense.payer_id)}`}
      </div>
      {editable && (
        <div>
          <button
            type="submit"
            disabled={!dirty || updateExpense.isPending}
          >
            Save
          </button>
          {updateExpense.error && (
            <span role="alert"> Error: {updateExpense.error.message}</span>
          )}
        </div>
      )}
    </form>
  )
}
