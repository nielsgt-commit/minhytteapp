import { createFileRoute } from "@tanstack/react-router"
import { PropertyOwnersPanel } from "@/features/property/owners/PropertyOwnersPanel"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/administrer/eierskap")({
  loader: ({ context }) => {
    const groupsQuery = context.queryClient.ensureQueryData(
      trpc.userGroup.listWithMembers.queryOptions(),
    )
    if (context.selectedPropertyId == null) return groupsQuery
    return Promise.all([
      groupsQuery,
      context.queryClient.ensureQueryData(
        trpc.user.listForProperty.queryOptions({
          property_id: context.selectedPropertyId,
        }),
      ),
    ])
  },
  component: PropertyOwnersPanel,
})
