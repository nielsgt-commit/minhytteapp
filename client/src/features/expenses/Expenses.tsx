import styles from "./Expenses.module.css"
import { ExpensesTestForm } from "@/features/expenses/testform/ExpensesTestForm.tsx"
import { MyExpenses } from "@/features/expenses/MyExpenses.tsx"
import { ReviewExpenses } from "@/features/expenses/ReviewExpenses.tsx"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

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
      <div className={styles.content}>
        <MyExpenses />
        <ReviewExpenses />
        <ExpensesTestForm />
      </div>
    </section>
  )
}