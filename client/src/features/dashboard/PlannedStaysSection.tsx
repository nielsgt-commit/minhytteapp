import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useTRPC } from "@/trpc/trpc"
import { MyPlannedStay } from "@/features/planstay/myplannedstay/MyPlannedStay.tsx"
import { PlannedMaintenanceSummary } from "@/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx"
import styles from "./PlannedStaysSection.module.css"

export function PlannedStaysSection({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const propertyName =
    properties.find(p => p.id === propertyId)?.name ?? "property"

  return (
    <section className={styles.section}>
      <Heading>{t("This year at {{propertyName}}", { propertyName })}</Heading>
      <Card asChild>
        <section>
          <Card.Block>
            <Heading level={2} data-size="xs">
              {t("My planned stays")}
            </Heading>
            <QueryBoundary>
              <MyPlannedStay />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
      <Card asChild>
        <section>
          <Card.Block>
            <QueryBoundary>
              <PlannedMaintenanceSummary mode="rest" />
            </QueryBoundary>
          </Card.Block>
        </section>
      </Card>
    </section>
  )
}
