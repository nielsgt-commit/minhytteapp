import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Status = "draft" | "submitted" | "reimbursed" | "rejected"
type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"

type ExpenseRow = {
  id: number
  description: string
  amount: number
  payer_id: number
  payer_name: string | null
  reimbursed_by_id: number | null
  booking_id: number | null
  maintenance_id: number | null
  settlement_id: number | null
  date: string
  status: Status
  receipt_url: string | null
  expense_types: ExpenseType[]
}

const STATUS_ORDER: Record<Status, number> = {
  draft: 0,
  submitted: 1,
  reimbursed: 2,
  rejected: 3,
}

export function MyExpenses() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: expenses } = useSuspenseQuery(trpc.expense.list.queryOptions())

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.expense.list.queryKey() })

  const deleteExpense = useMutation(
    trpc.expense.delete.mutationOptions({ onSuccess: invalidate }),
  )

  if (me == null) return null

  const mine = (expenses as ExpenseRow[])
    .filter(e => e.payer_id === me.id)
    .slice()
    .sort((a, b) => {
      const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (s !== 0) return s
      return a.date.localeCompare(b.date)
    })

  return (
    <section>
      <h3>My expenses</h3>
      {deleteExpense.error && (
        <p role="alert">Error: {deleteExpense.error.message}</p>
      )}
      {mine.length === 0 ? (
        <p>(no expenses)</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Types</th>
              <th>Receipt</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mine.map(e => (
              <MyExpenseRow
                key={e.id}
                expense={e}
                onSaved={invalidate}
                onDelete={() => {
                  deleteExpense.mutate({ id: e.id })
                }}
                deletePending={deleteExpense.isPending}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <strong>Total</strong>
              </td>
              <td>
                <strong>{mine.reduce((sum, e) => sum + e.amount, 0)}</strong>
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}

function MyExpenseRow({
  expense,
  onSaved,
  onDelete,
  deletePending,
}: {
  expense: ExpenseRow
  onSaved: () => void
  onDelete: () => void
  deletePending: boolean
}) {
  const trpc = useTRPC()
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [date, setDate] = useState(expense.date)

  const updateExpense = useMutation(
    trpc.expense.update.mutationOptions({
      onSuccess: () => {
        setEditing(false)
        onSaved()
      },
    }),
  )

  const editable = expense.status === "draft" || expense.status === "rejected"

  const handleSubmit = (ev: SyntheticEvent<HTMLFormElement>) => {
    ev.preventDefault()
    updateExpense.mutate({
      id: expense.id,
      description,
      amount: Number(amount),
      reimbursed_by_id: expense.reimbursed_by_id ?? undefined,
      booking_id: expense.booking_id ?? undefined,
      maintenance_id: expense.maintenance_id ?? undefined,
      settlement_id: expense.settlement_id ?? undefined,
      date,
      status: "submitted",
      receipt_url: expense.receipt_url,
      expense_types: expense.expense_types,
    })
  }

  const cancel = () => {
    setDescription(expense.description)
    setAmount(String(expense.amount))
    setDate(expense.date)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={7}>
          <form onSubmit={handleSubmit}>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={ev => {
                  setDate(ev.target.value)
                }}
                required
              />
            </label>
            <label>
              Description
              <input
                type="text"
                value={description}
                onChange={ev => {
                  setDescription(ev.target.value)
                }}
              />
            </label>
            <label>
              Amount
              <input
                type="number"
                step={1}
                value={amount}
                onChange={ev => {
                  setAmount(ev.target.value)
                }}
                required
              />
            </label>
            <button type="submit" disabled={updateExpense.isPending}>
              Submit
            </button>
            <button
              type="button"
              onClick={() => {
                cancel()
              }}
              disabled={updateExpense.isPending}
            >
              Cancel
            </button>
            {updateExpense.error && (
              <span role="alert"> Error: {updateExpense.error.message}</span>
            )}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{expense.date}</td>
      <td>{expense.description}</td>
      <td>{expense.amount}</td>
      <td>{expense.status}</td>
      <td>{expense.expense_types.join(", ")}</td>
      <td>
        {expense.receipt_url ? (
          <a href={expense.receipt_url} target="_blank" rel="noreferrer">
            link
          </a>
        ) : (
          ""
        )}
      </td>
      <td>
        {editable && (
          <>
            <button
              type="button"
              onClick={() => {
                setEditing(true)
              }}
              disabled={deletePending}
            >
              Edit and submit
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete()
              }}
              disabled={deletePending}
            >
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  )
}
