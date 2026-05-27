import { createFileRoute } from "@tanstack/react-router"
import { ManageProperty } from "@/features/property/ManageProperty"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trpc.property.mine.queryOptions()),
  component: ManageProperty,
})
