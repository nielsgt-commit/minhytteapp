import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import PlannedAvailabilitySummary from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import PlannedMaintenanceSummary from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { Card, Heading } from "@digdir/designsystemet-react"
import { startOfSunday } from "@/utils/dateUtils"
import styles from "./CalendarSummary.module.css"

export default function CalendarSummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )

  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  const [weekStart, setWeekStart] = useState(() => startOfSunday(new Date()))
  const resetWeek = () => {
    setWeekStart(startOfSunday(new Date()))
  }

  return (
    <section className={styles.summarySection}>
      <Heading onClick={resetWeek} className={styles.heading}>
        {t("This week at {{propertyName}}", { propertyName })}
      </Heading>
      <Card asChild>
        <section>
          <Card.Block>
            <PlannedAvailabilitySummary
              weekStart={weekStart}
              onWeekStartChange={setWeekStart}
            />
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <PlannedMaintenanceSummary mode="this-week" weekStart={weekStart} />
          </Card.Block>
        </section>
      </Card>
    </section>
  )
}
