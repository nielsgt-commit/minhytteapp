import { createFileRoute } from "@tanstack/react-router"
import { ListPropertyBuildings } from "@/features/property/testform/ListPropertyBuildings"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/manageproperty/buildings")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(trpc.building.list.queryOptions()),
      context.queryClient.ensureQueryData(trpc.room.list.queryOptions()),
    ]),
  component: ListPropertyBuildings,
})
