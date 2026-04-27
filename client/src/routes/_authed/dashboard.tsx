import { createFileRoute } from "@tanstack/react-router"
import { Dashboard } from "@/features/dashboard/Dashboard"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/dashboard")({
  loader: ({ context }) => {
    const propertyList = context.queryClient.ensureQueryData(
      trpc.property.list.queryOptions(),
    )
    if (selectSelectedPropertyId(store.getState()) == null) return propertyList
    return Promise.all([
      propertyList,
      context.queryClient.ensureQueryData(
        trpc.dashboard.summary.queryOptions(),
      ),
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
    ])
  },
  component: Dashboard,
})