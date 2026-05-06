import { createFileRoute } from "@tanstack/react-router"
import { UserGroups } from "@/features/usergroups/UserGroups"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/usergroups")({
  loader: ({ context }) => {
    const propertyId = selectSelectedPropertyId(store.getState())
    if (propertyId == null) return
    return Promise.all([
      context.queryClient.ensureQueryData(
        trpc.userGroup.listWithMembersForProperty.queryOptions({
          property_id: propertyId,
        }),
      ),
      context.queryClient.ensureQueryData(
        trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
      ),
    ])
  },
  component: UserGroups,
})