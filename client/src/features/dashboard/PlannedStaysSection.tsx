import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { MyPlannedStay } from "@/features/dashboard/myplannedstay/MyPlannedStay.tsx"
import PlannedMaintenanceSummary from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"

export default function PlannedStaysSection({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading>This year at {propertyName}</Heading>
          <MyPlannedStay />
          <PlannedMaintenanceSummary mode="rest" />
        </Card.Block>
      </section>
    </Card>
  )
}
