import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState, useTransition } from "react"
import { PlannedAvailabilitySummary } from "@/features/dashboard/calendarsummary/plannedavailability/PlannedAvailabilitySummary.tsx"
import { PlannedMaintenanceSummary } from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useTRPC } from "@/trpc/trpc.ts"
import { Card, Heading } from "@digdir/designsystemet-react"
import { Temporal } from "temporal-polyfill"
import { startOfSunday } from "@/utils/dateUtils"
import styles from "./CalendarSummary.module.css"

export function CalendarSummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )

  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  const [weekStart, setWeekStart] = useState(() =>
    startOfSunday(Temporal.Now.plainDateISO()),
  )
  // Transition so week navigation keeps the current week on screen while the
  // new week's suspense queries load, instead of dropping to the skeleton.
  const [isPending, startTransition] = useTransition()
  const changeWeek = (d: Temporal.PlainDate) => {
    startTransition(() => {
      setWeekStart(d)
    })
  }
  const resetWeek = () => {
    changeWeek(startOfSunday(Temporal.Now.plainDateISO()))
  }

  return (
    <section
      className={`${styles.summarySection}${isPending ? ` ${styles.pending}` : ""}`}
    >
      <Heading onClick={resetWeek} className={styles.heading}>
        {t("This week at {{propertyName}}", { propertyName })}
      </Heading>
      <Card asChild>
        <section>
          <Card.Block>
            <QueryBoundary>
              <PlannedAvailabilitySummary
                weekStart={weekStart}
                onWeekStartChange={changeWeek}
              />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <QueryBoundary>
              <PlannedMaintenanceSummary
                mode="this-week"
                weekStart={weekStart}
              />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
    </section>
  )
}
