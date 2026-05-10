import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Card, Tag, Textfield } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

type Status = "draft" | "submitted" | "reimbursed" | "rejected"
type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"

type ExpenseRow = {
  id: number
  property_id: number | null
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

const STATUS_COLOR: Record<Status, "info" | "success" | "warning" | "danger" | "neutral"> = {
  draft: "neutral",
  submitted: "info",
  reimbursed: "success",
  rejected: "danger",
}

export function MyExpenses() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.expense.pathKey() })

  const deleteExpense = useMutation(
    trpc.expense.delete.mutationOptions({ onSuccess: invalidate }),
  )

  if (me == null || selectedPropertyId == null) return null

  const mine = (expenses as ExpenseRow[])
    .filter(e => e.payer_id === me.id)
    .slice()
    .sort((a, b) => {
      const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (s !== 0) return s
      return a.date.localeCompare(b.date)
    })

  if (mine.length === 0) return null

  return (
    <>
      {deleteExpense.error && (
        <p role="alert">Error: {deleteExpense.error.message}</p>
      )}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {mine.map(e => (
          <li key={e.id}>
            <MyExpenseCard
              expense={e}
              propertyId={selectedPropertyId}
              onSaved={invalidate}
              onDelete={() => {
                deleteExpense.mutate({ id: e.id })
              }}
              deletePending={deleteExpense.isPending}
            />
          </li>
        ))}
      </ul>
    </>
  )
}

function MyExpenseCard({
  expense,
  propertyId,
  onSaved,
  onDelete,
  deletePending,
}: {
  expense: ExpenseRow
  propertyId: number
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

  const handleSubmit = (ev: SyntheticEvent<HTMLFormElement>) => {
    ev.preventDefault()
    updateExpense.mutate({
      id: expense.id,
      property_id: expense.property_id ?? propertyId,
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

  const categoryLabel =
    expense.expense_types.length > 0
      ? expense.expense_types.join(", ")
      : "(no category)"

  return (
    <Card>
      <Card.Block>
        {editing ? (
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <Textfield
                label="Date"
                type="date"
                value={date}
                onChange={ev => { setDate(ev.target.value) }}
                required
              />
              <Textfield
                label="Description"
                value={description}
                onChange={ev => { setDescription(ev.target.value) }}
              />
              <Textfield
                label="Amount"
                type="number"
                step={1}
                value={amount}
                onChange={ev => { setAmount(ev.target.value) }}
                required
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button type="submit" disabled={updateExpense.isPending}>
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={updateExpense.isPending}
                  onClick={() => { cancel() }}
                >
                  Cancel
                </Button>
              </div>
              {updateExpense.error && (
                <span role="alert">Error: {updateExpense.error.message}</span>
              )}
            </div>
          </form>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "0.125rem 0.625rem",
                  border: "1px solid currentColor",
                  borderRadius: "999px",
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                }}
              >
                {categoryLabel}
              </span>
              <Tag data-color={STATUS_COLOR[expense.status]}>
                {expense.status}
              </Tag>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>{expense.amount},-</span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  variant="tertiary"
                  data-size="sm"
                  disabled={deletePending}
                  onClick={() => { setEditing(true) }}
                >
                  Edit
                </Button>
                <Button
                  variant="tertiary"
                  data-color="danger"
                  data-size="sm"
                  disabled={deletePending}
                  onClick={() => { onDelete() }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card.Block>
    </Card>
  )
}
