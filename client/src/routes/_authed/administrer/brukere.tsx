import { createFileRoute } from "@tanstack/react-router"
import { Users } from "@/features/usergroups/Users"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/administrer/brukere")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    const meQuery = context.queryClient.ensureQueryData(
      trpc.user.me.queryOptions(),
    )
    if (selectedPropertyId == null) return meQuery
    return Promise.all([
      meQuery,
      context.queryClient.ensureQueryData(
        trpc.user.listForProperty.queryOptions({
          property_id: selectedPropertyId,
        }),
      ),
    ])
  },
  component: Users,
})
