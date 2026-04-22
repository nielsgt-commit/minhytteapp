import { createFileRoute } from "@tanstack/react-router"
import { Settlement } from "@/features/settlement/Settlement"
import { settlementQueries } from "@/features/settlement/api/queries"

export const Route = createFileRoute("/_authed/settlement")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(settlementQueries.balances()),
  component: Settlement,
})
