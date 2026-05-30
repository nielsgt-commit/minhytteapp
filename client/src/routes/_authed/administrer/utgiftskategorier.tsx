import { createFileRoute } from "@tanstack/react-router"
import { ManageCategories } from "@/features/expenses/categories/ManageCategories"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/administrer/utgiftskategorier")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      trpc.expenseCategory.list.queryOptions(),
    ),
  component: ManageCategories,
})
