import { createFileRoute } from "@tanstack/react-router"
import { Expenses } from "@/features/expenses/Expenses"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/expenses")({
  loader: ({ context }) => {
    if (selectSelectedPropertyId(store.getState()) == null) return
    return context.queryClient.ensureQueryData(trpc.expense.list.queryOptions())
  },
  component: Expenses,
})