import { createFileRoute } from "@tanstack/react-router"
import { ManageCategories } from "@/features/expenses/categories/ManageCategories"

export const Route = createFileRoute("/_authed/administrer/utgiftskategorier")({
  component: ManageCategories,
})
