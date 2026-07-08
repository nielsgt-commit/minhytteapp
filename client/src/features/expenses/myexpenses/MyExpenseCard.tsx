import { Card } from "@digdir/designsystemet-react"
import type { Temporal } from "temporal-polyfill"
import styles from "./MyExpenses.module.css"
import { MyExpenseRow } from "./MyExpenseRow.tsx"
import { MyExpenseEditForm } from "./MyExpenseEditForm.tsx"
import type { ExpenseRow } from "../types.ts"
import { toUpdateInput } from "../buildUpdatePayload.ts"
import { useToggleState } from "@/hooks/useToggleState"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"

type Props = {
  expense: ExpenseRow
  propertyId: number
  onDelete: () => void
  deletePending: boolean
}

export function MyExpenseCard({
  expense,
  propertyId,
  onDelete,
  deletePending,
}: Props) {
  const editing = useToggleState()
  const trpc = useTRPC()

  const updateExpense = useMutationWithInvalidation(
    trpc.expense.update.mutationOptions(),
    [trpc.expense.pathKey()],
  )

  const changeReceiptDate = (next: Temporal.PlainDate) => {
    updateExpense.mutate(
      toUpdateInput(expense, propertyId, {
        status: expense.status,
        receipt_date: next,
      }),
    )
  }

  return (
    <Card asChild>
      <article>
        <Card.Block
          className={editing.value ? undefined : styles.row}
          data-size="sm"
        >
          {editing.value ? (
            <MyExpenseEditForm
              key={expense.id}
              expense={expense}
              propertyId={propertyId}
              onSaved={editing.close}
              onCancel={editing.close}
            />
          ) : (
            <MyExpenseRow
              expense={expense}
              deletePending={deletePending}
              receiptDatePending={updateExpense.isPending}
              onReceiptDateChange={changeReceiptDate}
              onEdit={editing.open}
              onDelete={onDelete}
            />
          )}
          <ErrorAlert error={editing.value ? null : updateExpense.error} />
        </Card.Block>
      </article>
    </Card>
  )
}
