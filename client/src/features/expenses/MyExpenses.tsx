import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import styles from "./MyExpenses.module.css"
import { MyExpenseCard, type ExpenseRow } from "./MyExpenseCard"
import { STATUS_ORDER } from "./expenseStatus"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

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
      <ul className={styles.list}>
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
