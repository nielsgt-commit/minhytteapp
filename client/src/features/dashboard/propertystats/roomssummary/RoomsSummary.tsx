import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button, List } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import { StatCard } from "@/features/dashboard/propertystats/StatCard"
import styles from "@/features/dashboard/propertystats/PropertyStats.module.css"

export function RoomsSummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const totals = rooms.reduce(
    (acc, r) => {
      acc.beds_sm += r.beds_sm
      acc.beds_lg += r.beds_lg
      acc.beds_double += r.beds_double
      acc.beds_kid += r.beds_kid
      acc.mattresses += r.mattresses
      acc.travel_cot += r.travel_cot
      return acc
    },
    {
      beds_sm: 0,
      beds_lg: 0,
      beds_double: 0,
      beds_kid: 0,
      mattresses: 0,
      travel_cot: 0,
    },
  )

  return (
    <StatCard
      title={t("Bedrooms")}
      count={rooms.length}
      content={
        rooms.length === 0 ? (
          <EmptyState title={t("No rooms yet.")} />
        ) : (
          <List.Unordered className={styles.list}>
            <List.Item className={styles.row}>
              <span>{t("Beds (single)")}</span>
              <span>{totals.beds_sm}</span>
            </List.Item>
            <List.Item className={styles.row}>
              <span>{t("Beds (large)")}</span>
              <span>{totals.beds_lg}</span>
            </List.Item>
            <List.Item className={styles.row}>
              <span>{t("Beds (double)")}</span>
              <span>{totals.beds_double}</span>
            </List.Item>
            <List.Item className={styles.row}>
              <span>{t("Beds (kid)")}</span>
              <span>{totals.beds_kid}</span>
            </List.Item>
            <List.Item className={styles.row}>
              <span>{t("Mattresses")}</span>
              <span>{totals.mattresses}</span>
            </List.Item>
            <List.Item className={styles.row}>
              <span>{t("Travel cots")}</span>
              <span>{totals.travel_cot}</span>
            </List.Item>
          </List.Unordered>
        )
      }
      footer={
        <Button asChild variant="secondary" className={styles.footerButton}>
          <Link to="/administrer/bygninger">{t("Manage rooms")}</Link>
        </Button>
      }
    />
  )
}
