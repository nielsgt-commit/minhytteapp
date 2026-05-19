import { createFileRoute } from "@tanstack/react-router"
import { UserGroups } from "@/features/usergroups/UserGroups"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty/usergroups")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return Promise.all([
      context.queryClient.ensureQueryData(
        trpc.userGroup.listWithMembersForProperty.queryOptions({
          property_id: selectedPropertyId,
        }),
      ),
      context.queryClient.ensureQueryData(
        trpc.user.listForProperty.queryOptions({
          property_id: selectedPropertyId,
        }),
      ),
    ])
  },
  component: UserGroups,
})
