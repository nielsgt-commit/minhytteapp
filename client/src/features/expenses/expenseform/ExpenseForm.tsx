import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { Temporal } from "temporal-polyfill"
import {
  AddNewExpenseFlow,
  type ExpenseDraft,
} from "@/features/expenses/expenseform/AddNewExpenseFlow.tsx"

export function ExpenseForm() {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const createMutation = useMutationWithInvalidation(
    trpc.expense.create.mutationOptions(),
    [trpc.expense.pathKey()],
  )

  const submitDrafts = (drafts: ExpenseDraft[], description: string) => {
    if (selectedPropertyId == null) return
    const date = Temporal.Now.plainDateISO()
    for (const d of drafts) {
      createMutation.mutate({
        property_id: selectedPropertyId,
        description,
        amount: d.amount,
        receipt_url: null,
        date,
        status: "submitted",
        expense_types: [d.category],
      })
    }
  }

  if (selectedPropertyId == null) {
    return (
      <section>
        <EmptyState title={t("Select a property to record expenses.")} />
      </section>
    )
  }

  return (
    <section>
      <AddNewExpenseFlow
        categories={categories}
        pending={createMutation.isPending}
        onSubmit={submitDrafts}
        onCancel={() => {
          createMutation.reset()
        }}
      />
      <ErrorAlert error={createMutation.error} />
    </section>
  )
}
