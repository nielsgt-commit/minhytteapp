import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Details } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./MyExpenses.module.css"
import { MyExpenseCard } from "./MyExpenseCard.tsx"
import type { ExpenseRow } from "../types.ts"
import { selectMyExpenses } from "../selectors.ts"
import { useInvalidateExpenses } from "../useInvalidateExpenses.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"

export function MyExpenses() {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const invalidate = useInvalidateExpenses()

  const deleteExpense = useMutationWithInvalidation(
    trpc.expense.delete.mutationOptions(),
    [trpc.expense.pathKey()],
  )

  if (selectedPropertyId == null) return null

  const mine = selectMyExpenses(expenses as ExpenseRow[], me.id)

  if (mine.length === 0) return null

  return (
    <Details>
      <Details.Summary>
        {t("My expenses ({{count}})", { count: mine.length })}
      </Details.Summary>
      <Details.Content className={styles.content}>
        {deleteExpense.error && (
          <p role="alert">
            {t("Error: {{message}}", { message: deleteExpense.error.message })}
          </p>
        )}
        <ul className={styles.list}>
          {mine.map(e => (
            <li key={e.id}>
              <MyExpenseCard
                expense={e}
                propertyId={selectedPropertyId}
                onSaved={() => {
                  void invalidate()
                }}
                onDelete={() => {
                  deleteExpense.mutate({ id: e.id })
                }}
                deletePending={deleteExpense.isPending}
              />
            </li>
          ))}
        </ul>
      </Details.Content>
    </Details>
  )
}
