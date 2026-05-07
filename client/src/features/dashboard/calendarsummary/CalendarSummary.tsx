import PlannedAvailabilitySummary
  from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import PlannedMaintenanceSummary
  from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { useSuspenseQuery } from "@tanstack/react-query"
import { trpc } from "@/trpc/client.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { Heading } from "@digdir/designsystemet-react"





export default function CalendarSummary() {

  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"



  return (
    <>
      <Heading> This week at {propertyName}</Heading>
      <PlannedAvailabilitySummary />
      <PlannedMaintenanceSummary />
    </>
  )

}