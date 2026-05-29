import { createFileRoute } from "@tanstack/react-router"
import { UserGroups } from "@/features/usergroups/UserGroups"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/administrer/brukergrupper")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    const meQuery = context.queryClient.ensureQueryData(
      trpc.user.me.queryOptions(),
    )
    if (selectedPropertyId == null) return meQuery
    return Promise.all([
      meQuery,
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
