import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"
import {
  AddNewExpenseFlow,
  type ExpenseDraft,
} from "@/features/expenses/testform/AddNewExpenseFlow.tsx"

const todayIso = () => new Date().toISOString().slice(0, 10)

export function ExpensesTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.expense.pathKey() })

  const createMutation = useMutation(
    trpc.expense.create.mutationOptions({ onSuccess: invalidate }),
  )

  const submitDrafts = (drafts: ExpenseDraft[], description: string) => {
    if (selectedPropertyId == null) return
    const date = todayIso()
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
        <p>Select a property to record expenses.</p>
      </section>
    )
  }

  return (
    <section>
      <AddNewExpenseFlow
        categories={categories}
        pending={createMutation.isPending}
        onSubmit={submitDrafts}
        onCancel={() => { createMutation.reset() }}
      />
      {createMutation.error && (
        <p role="alert">Error: {createMutation.error.message}</p>
      )}
    </section>
  )
}
