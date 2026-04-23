import { createFileRoute } from "@tanstack/react-router"
import { Settlement } from "@/features/settlement/Settlement"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/settlement")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trpc.settlement.list.queryOptions()),
  component: Settlement,
})