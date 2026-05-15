import { Suspense } from "react"
import { Details } from "@digdir/designsystemet-react"
import { useSuspenseQuery } from "@tanstack/react-query"
import styles from "./Expenses.module.css"
import { ExpensesTestForm } from "@/features/expenses/testform/ExpensesTestForm.tsx"
import { MyExpenses } from "@/features/expenses/MyExpenses.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

export function Expenses() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h2 className={styles.title}>Expenses</h2>
        <p>Add or select a property to track shared costs and keep receipts in one place.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Expenses</h2>
      <Suspense fallback={<p>Loading…</p>}>
        <ExpensesTestForm />
        <MyExpensesPanel propertyId={selectedPropertyId} />
      </Suspense>
    </section>
  )
}

function MyExpensesPanel({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
  )

  if (me == null) return null
  const myCount = expenses.filter(e => e.payer_id === me.id).length
  if (myCount === 0) return null

  return (
    <Details>
      <Details.Summary>My expenses ({myCount})</Details.Summary>
      <Details.Content style={{ padding: 0 }}>
        <MyExpenses />
      </Details.Content>
    </Details>
  )
}
