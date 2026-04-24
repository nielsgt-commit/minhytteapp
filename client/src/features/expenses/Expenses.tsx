import styles from "./Expenses.module.css"
import { ExpensesTestForm } from "@/features/expenses/testform/ExpensesTestForm.tsx"

export function Expenses() {
  return (
    <section className={styles.page}>
      <h2 className={styles.title}>Expenses</h2>
      <div className={styles.content}>
        <ExpensesTestForm />
      </div>
    </section>
  )
}