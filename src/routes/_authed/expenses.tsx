import { createFileRoute } from "@tanstack/react-router"
import { Expenses } from "@/features/expenses/Expenses"
import { expenseQueries } from "@/features/expenses/api/queries"

export const Route = createFileRoute("/_authed/expenses")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(expenseQueries.list()),
  component: Expenses,
})
