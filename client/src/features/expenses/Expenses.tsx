import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./Expenses.module.css"
import { ExpensesTestForm } from "@/features/expenses/testform/ExpensesTestForm.tsx"
import { MyExpenses } from "@/features/expenses/myexpenses/MyExpenses.tsx"

export function Expenses() {
  const { t } = useTranslation("expenses")
  const selectedPropertyId = useSelectedPropertyId()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.title}>
        {t("Expenses")}
      </Heading>
        <p>
          {t(
            "Add or select a property to track shared costs and keep receipts in one place.",
          )}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <Heading level={2} className={styles.title}>
        {t("Expenses")}
      </Heading>
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <ExpensesTestForm />
        <MyExpenses />
      </Suspense>
    </section>
  )
}
