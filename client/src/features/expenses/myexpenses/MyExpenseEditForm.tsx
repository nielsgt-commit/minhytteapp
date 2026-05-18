import { type SyntheticEvent, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button, Textfield } from "@digdir/designsystemet-react"
import styles from "./MyExpenses.module.css"
import type { ExpenseRow } from "../types.ts"
import { toUpdateInput } from "../buildUpdatePayload.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type Props = {
  expense: ExpenseRow
  propertyId: number
  onSaved: () => void
  onCancel: () => void
}

export function MyExpenseEditForm({
  expense,
  propertyId,
  onSaved,
  onCancel,
}: Props) {
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

  const handleSubmit = (ev: SyntheticEvent<HTMLFormElement>) => {
    ev.preventDefault()
    updateExpense.mutate(
      toUpdateInput(expense, propertyId, {
        description,
        amount: Number(amount),
        date,
        status: "submitted",
      }),
    )
  }

  const cancel = () => {
    setDescription(expense.description)
    setAmount(String(expense.amount))
    setDate(expense.date)
    onCancel()
  }

  return (
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
  )
}
