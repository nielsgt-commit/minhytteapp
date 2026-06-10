import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button, List } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import { StatCard } from "@/features/dashboard/propertystats/StatCard"
import styles from "@/features/dashboard/propertystats/PropertyStats.module.css"

const CATEGORIES = ["Boat", "Appliance", "Tool"] as const

export function EquipmentSummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: equipment } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const countByCategory = new Map<string, number>(CATEGORIES.map(c => [c, 0]))
  for (const item of equipment) {
    const raw = item.category?.trim()
    if (!raw) continue
    const match = CATEGORIES.find(c => c.toLowerCase() === raw.toLowerCase())
    if (!match) continue
    countByCategory.set(match, (countByCategory.get(match) ?? 0) + 1)
  }

  return (
    <StatCard
      title={t("Equipment")}
      count={CATEGORIES.length}
      content={
        equipment.length === 0 ? (
          <EmptyState title={t("No equipment yet.")} />
        ) : (
          <List.Unordered className={styles.list}>
            {CATEGORIES.map(cat => {
              const count = countByCategory.get(cat) ?? 0
              const label =
                cat === "Boat"
                  ? t("Boat")
                  : cat === "Appliance"
                    ? t("Appliance")
                    : t("Tool")
              return (
                <List.Item key={cat} className={styles.row}>
                  <span>{label}</span>
                  <span>{count}</span>
                </List.Item>
              )
            })}
          </List.Unordered>
        )
      }
      footer={
        <Button asChild variant="secondary" className={styles.footerButton}>
          <Link to="/administrer/utstyr">{t("Manage equipment")}</Link>
        </Button>
      }
    />
  )
}
