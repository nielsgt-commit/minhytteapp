import { createFileRoute } from "@tanstack/react-router"
import { UserGroups } from "@/features/usergroups/UserGroups"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/usergroups")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        trpc.userGroup.listWithMembers.queryOptions(),
      ),
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
    ]),
  component: UserGroups,
})