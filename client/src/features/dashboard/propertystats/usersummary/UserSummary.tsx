import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button, List } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import { StatCard } from "@/features/dashboard/propertystats/StatCard"
import styles from "@/features/dashboard/propertystats/PropertyStats.module.css"

export function UserSummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: userGroups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  return (
    <StatCard
      title={t("User groups")}
      count={userGroups.length}
      content={
        userGroups.length === 0 ? (
          <EmptyState title={t("No user groups yet.")} />
        ) : (
          <List.Unordered className={styles.list}>
            {userGroups.map(g => (
              <List.Item key={g.id} className={styles.row}>
                <span>{g.name}</span>
                <span>
                  {t("{{count}} member", { count: g.members.length })}
                </span>
              </List.Item>
            ))}
          </List.Unordered>
        )
      }
      footer={
        <Button asChild variant="secondary" className={styles.footerButton}>
          <Link to="/administrer/brukergrupper">{t("Manage user groups")}</Link>
        </Button>
      }
    />
  )
}
