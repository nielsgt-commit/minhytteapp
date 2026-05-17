import { type SyntheticEvent, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  Button,
  Card,
  Divider,
  Paragraph,
  Tag,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./MyExpenses.module.css"
import { STATUS_COLOR, type Status } from "./expenseStatus"
import { useTRPC } from "@/trpc/trpc"

type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"

export type ExpenseRow = {
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

type Props = {
  expense: ExpenseRow
  propertyId: number
  onSaved: () => void
  onDelete: () => void
  deletePending: boolean
}

export function MyExpenseCard({
  expense,
  propertyId,
  onSaved,
  onDelete,
  deletePending,
}: Props) {
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
    <Card asChild>
      <article>
        <Card.Block className={editing ? undefined : styles.row} data-size="sm">
          {editing ? (
            <form onSubmit={handleSubmit} className={styles.editForm}>
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
              <div className={styles.editActions}>
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
            </form>
          ) : (
            <>
              <Paragraph asChild data-size="sm">
                <span className={styles.category}>{categoryLabel}</span>
              </Paragraph>
              <Paragraph className={styles.statusLabel} data-size="sm">
                Status
              </Paragraph>
              <Tag
                className={styles.statusTag}
                data-color={STATUS_COLOR[expense.status]}
                data-size="sm"
              >
                {expense.status}
              </Tag>
              <Paragraph className={styles.sumLabel} data-size="sm">
                Sum
              </Paragraph>
              <div className={styles.amountGroup}>
                <Paragraph asChild data-size="sm">
                  <span>{expense.amount}</span>
                </Paragraph>
                <Paragraph asChild data-size="sm">
                  <span>,-</span>
                </Paragraph>
              </div>
              <Divider className={styles.divider} />
              <div className={styles.actions}>
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
            </>
          )}
        </Card.Block>
      </article>
    </Card>
  )
}
