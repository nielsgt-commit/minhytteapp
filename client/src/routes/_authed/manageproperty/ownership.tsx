import { createFileRoute } from "@tanstack/react-router"
import { PropertyOwnersPanel } from "@/features/property/owners/PropertyOwnersPanel"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty/ownership")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(trpc.user.list.queryOptions()),
      context.queryClient.ensureQueryData(
        trpc.userGroup.listWithMembers.queryOptions(),
      ),
    ]),
  component: PropertyOwnersPanel,
})
