import { createFileRoute } from "@tanstack/react-router"
import { Invites } from "@/features/usergroups/Invites"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty/invites")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    const meQuery = context.queryClient.ensureQueryData(
      trpc.user.me.queryOptions(),
    )
    if (selectedPropertyId == null) return meQuery
    return Promise.all([
      meQuery,
      context.queryClient.ensureQueryData(
        trpc.allowedEmail.list.queryOptions({
          property_id: selectedPropertyId,
        }),
      ),
      context.queryClient.ensureQueryData(
        trpc.userGroup.listWithMembersForProperty.queryOptions({
          property_id: selectedPropertyId,
        }),
      ),
    ])
  },
  component: Invites,
})
