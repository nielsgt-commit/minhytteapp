import PlannedAvailabilitySummary
  from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import PlannedMaintenanceSummary
  from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"

export default function CalendarSummary() {
  return (
    <>
      <h1>Calendar Summary</h1>
      <PlannedAvailabilitySummary />
      <PlannedMaintenanceSummary />
    </>
  )

}