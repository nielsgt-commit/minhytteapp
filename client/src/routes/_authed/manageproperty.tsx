import { createFileRoute } from "@tanstack/react-router"
import { ManageProperty } from "@/features/property/ManageProperty"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(trpc.property.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.building.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
      context.queryClient.ensureQueryData(
        trpc.userGroup.listWithMembers.queryOptions(),
      ),
    ]),
  component: ManageProperty,
})