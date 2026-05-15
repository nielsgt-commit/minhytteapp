import { useState } from "react"
import PlannedAvailabilitySummary
  from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import PlannedMaintenanceSummary
  from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { Card, Heading } from "@digdir/designsystemet-react"

function startOfSunday(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}


export default function CalendarSummary() {

  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  const [weekStart, setWeekStart] = useState(() => startOfSunday(new Date()))
  const resetWeek = () => { setWeekStart(startOfSunday(new Date())) }

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading onClick={resetWeek} style={{ cursor: "pointer" }}>
            This week at {propertyName}
          </Heading>
          <PlannedAvailabilitySummary
            weekStart={weekStart}
            onWeekStartChange={setWeekStart}
          />
          <PlannedMaintenanceSummary mode="this-week" weekStart={weekStart} />
        </Card.Block>
      </section>
    </Card>
  )

}