import { Card } from "@digdir/designsystemet-react"
import styles from "./MyExpenses.module.css"
import { MyExpenseRow } from "./MyExpenseRow.tsx"
import { MyExpenseEditForm } from "./MyExpenseEditForm.tsx"
import type { ExpenseRow } from "../types.ts"
import { useToggleState } from "@/hooks/useToggleState"

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
              onEdit={editing.open}
              onDelete={onDelete}
            />
          )}
        </Card.Block>
      </article>
    </Card>
  )
}
