import { createFileRoute } from "@tanstack/react-router"
import { PlanStay } from "@/features/planstay/PlanStay"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/planleggopphold")({
  loader: ({ context }) => {
    const tasks: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(trpc.user.me.queryOptions()),
    ]
    const { selectedPropertyId } = context
    if (selectedPropertyId != null) {
      tasks.push(
        context.queryClient.ensureQueryData(
          trpc.booking.listForProperty.queryOptions({
            property_id: selectedPropertyId,
          }),
        ),
      )
    }
    return Promise.all(tasks)
  },
  component: PlanStay,
})
