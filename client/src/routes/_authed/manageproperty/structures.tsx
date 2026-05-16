import { createFileRoute } from "@tanstack/react-router"
import { ListPropertyStructures } from "@/features/property/testform/ListPropertyStructures"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty/structures")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(trpc.structure.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.room.list.queryOptions()),
    ]),
  component: ListPropertyStructures,
})
