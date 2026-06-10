import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTranslation } from "react-i18next"
import styles from "./Expenses.module.css"
import { ExpenseForm } from "@/features/expenses/expenseform/ExpenseForm.tsx"
import { MyExpenses } from "@/features/expenses/myexpenses/MyExpenses.tsx"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import type { PageHelpContent } from "@/components/shared/PageHelp"

export function Expenses() {
  const { t } = useTranslation("expenses")
  const selectedPropertyId = useSelectedPropertyId()

  const help: PageHelpContent = {
    intro: t(
      "This is where you log shared costs you've paid for the cabin and keep the receipts in one place. You can add several costs at once and check back on the ones you've already submitted.",
    ),
    steps: [
      {
        title: t("Pick a category"),
        body: t(
          "Choose what the cost was for, such as firewood or repairs. The list of categories is set up for each cabin.",
        ),
      },
      {
        title: t("Enter the amount"),
        body: t(
          "Type how much you paid and add it to the list. Repeat to log several costs before sending them in.",
        ),
      },
      {
        title: t("Add a description and submit"),
        body: t(
          "Add an optional note so others know what the cost covered, then submit. You can review and edit the ones you've submitted afterwards under My expenses.",
        ),
      },
    ],
    connections: [
      t(
        "Anyone in the group can add their own costs here and follow them under My expenses. You can edit or delete one as long as the open settlement is still gathering expenses; once it moves on, your submitted costs are locked. The categories you choose from are set up for each cabin under Manage Property (Expense categories).",
      ),
      t(
        "Every household has a head (and admins count as one too). The head is the person who checks the costs everyone submits — that happens inside a Settlement, where the head goes through each one and either reimburses it (approves it for sharing) or rejects it. Regular members don't see this review step; they just see whether their cost was approved.",
      ),
      t(
        "So a cost travels like this: you log it here → the household head approves or rejects it during a settlement → approved costs are pooled and split between the households in Settlement.",
      ),
    ],
  }

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Expenses")} help={help} />
        <EmptyState
          title={t(
            "Add or select a property to track shared costs and keep receipts in one place.",
          )}
        />
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Expenses")} help={help} />
      <QueryBoundary>
        <ExpenseForm />
        <MyExpenses />
      </QueryBoundary>
    </section>
  )
}
