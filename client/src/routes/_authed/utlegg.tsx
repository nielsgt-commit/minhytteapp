import { createFileRoute } from "@tanstack/react-router"
import { Expenses } from "@/features/expenses/Expenses"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/utlegg")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.expense.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: Expenses,
})
