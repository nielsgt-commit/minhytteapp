import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button, List } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import { StatCard } from "@/features/dashboard/propertystats/StatCard"
import styles from "@/features/dashboard/propertystats/PropertyStats.module.css"

export function StructureSummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const roomCountByStructure = new Map<number, number>()
  for (const r of rooms) {
    roomCountByStructure.set(
      r.structure_id,
      (roomCountByStructure.get(r.structure_id) ?? 0) + 1,
    )
  }

  return (
    <StatCard
      title={t("Structures")}
      count={structures.length}
      content={
        structures.length === 0 ? (
          <EmptyState title={t("No Structures yet.")} />
        ) : (
          <List.Unordered className={styles.list}>
            {structures.map(b => {
              const count = roomCountByStructure.get(b.id) ?? 0
              return (
                <List.Item key={b.id} className={styles.row}>
                  <span>{b.name}</span>
                  <span>{t("{{count}} room", { count })}</span>
                </List.Item>
              )
            })}
          </List.Unordered>
        )
      }
      footer={
        <Button asChild variant="secondary" className={styles.footerButton}>
          <Link to="/administrer/bygninger">{t("Manage Structures")}</Link>
        </Button>
      }
    />
  )
}
