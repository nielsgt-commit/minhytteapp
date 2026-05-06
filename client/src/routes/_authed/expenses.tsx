import { createFileRoute } from "@tanstack/react-router"
import { Expenses } from "@/features/expenses/Expenses"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/expenses")({
  loader: ({ context }) => {
    const propertyId = selectSelectedPropertyId(store.getState())
    if (propertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
    )
  },
  component: Expenses,
})