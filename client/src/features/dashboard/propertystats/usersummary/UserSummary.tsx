import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  Button,
  List,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import StatCard from "@/features/dashboard/propertystats/StatCard"
import styles from "@/features/dashboard/propertystats/PropertyStats.module.css"

export default function UserSummary() {
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: userGroups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  return (
    <StatCard
      title="User groups"
      count={userGroups.length}
      content={userGroups.length === 0 ? (
        <Paragraph>No user groups yet.</Paragraph>
      ) : (
        <List.Unordered className={styles.list}>
          {userGroups.map(g => (
            <List.Item key={g.id} className={styles.row}>
              <span>{g.name}</span>
              <span>
                {g.members.length} member{g.members.length === 1 ? "" : "s"}
              </span>
            </List.Item>
          ))}
        </List.Unordered>
      )}
      footer={(
        <Button asChild variant="secondary" className={styles.footerButton}>
          <Link to="/manageproperty/usergroups">Manage user groups</Link>
        </Button>
      )}
    />
  )
}
