import { createFileRoute } from "@tanstack/react-router"
import { Expenses } from "@/features/expenses/Expenses"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/expenses")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trpc.expense.list.queryOptions()),
  component: Expenses,
})