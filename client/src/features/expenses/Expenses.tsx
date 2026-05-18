import { Suspense } from "react"
import styles from "./Expenses.module.css"
import { ExpensesTestForm } from "@/features/expenses/testform/ExpensesTestForm.tsx"
import { MyExpenses } from "@/features/expenses/myexpenses/MyExpenses.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export function Expenses() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Expenses</h1>
        <p>Add or select a property to track shared costs and keep receipts in one place.</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Expenses</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <ExpensesTestForm />
        <MyExpenses />
      </Suspense>
    </section>
  )
}
