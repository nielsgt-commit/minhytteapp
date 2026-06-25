import { createFileRoute } from "@tanstack/react-router"
import { Todos } from "@/features/todos/Todos"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/oppgaver")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.todo.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: Todos,
})
