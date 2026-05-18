import { useState } from "react"
import { Card } from "@digdir/designsystemet-react"
import styles from "./MyExpenses.module.css"
import { MyExpenseRow } from "./MyExpenseRow.tsx"
import { MyExpenseEditForm } from "./MyExpenseEditForm.tsx"
import type { ExpenseRow } from "../types.ts"

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
  const [editing, setEditing] = useState(false)

  return (
    <Card asChild>
      <article>
        <Card.Block className={editing ? undefined : styles.row} data-size="sm">
          {editing ? (
            <MyExpenseEditForm
              expense={expense}
              propertyId={propertyId}
              onSaved={() => {
                setEditing(false)
                onSaved()
              }}
              onCancel={() => { setEditing(false) }}
            />
          ) : (
            <MyExpenseRow
              expense={expense}
              deletePending={deletePending}
              onEdit={() => { setEditing(true) }}
              onDelete={onDelete}
            />
          )}
        </Card.Block>
      </article>
    </Card>
  )
}
