import { Suspense } from "react"
import styles from "./Expenses.module.css"
import { ExpenseCategories } from "@/features/expenses/ExpenseCategories.tsx"
import { ExpensesTestForm } from "@/features/expenses/testform/ExpensesTestForm.tsx"
import { MyExpenses } from "@/features/expenses/MyExpenses.tsx"
import { PreliminarySettlement } from "@/features/expenses/PreliminarySettlement.tsx"
import { RecurringPropertyFees } from "@/features/expenses/RecurringPropertyFees.tsx"
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
      <Suspense fallback={<p>Loading…</p>}>
        <div className={styles.review}>
          <ReviewExpenses />
        </div>
        <div className={styles.panels}>
          <RecurringPropertyFees />
          <ExpenseCategories />
          <PreliminarySettlement />
        </div>
        <div className={styles.mine}>
          <MyExpenses />
        </div>
      </Suspense>
      <div className={styles.testform}>
        <ExpensesTestForm />
      </div>
    </section>
  )
}