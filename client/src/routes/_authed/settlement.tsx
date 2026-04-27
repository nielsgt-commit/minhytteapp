import { createFileRoute } from "@tanstack/react-router"
import { Settlement } from "@/features/settlement/Settlement"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/settlement")({
  loader: ({ context }) => {
    if (selectSelectedPropertyId(store.getState()) == null) return
    return context.queryClient.ensureQueryData(
      trpc.settlement.list.queryOptions(),
    )
  },
  component: Settlement,
})