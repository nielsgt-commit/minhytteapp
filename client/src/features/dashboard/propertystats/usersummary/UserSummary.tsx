import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  Button,
  List,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import StatCard from "@/features/dashboard/propertystats/StatCard"

export default function UserSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
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
        <List.Unordered style={{ listStyle: "none", padding: 0 }}>
          {userGroups.map(g => (
            <List.Item key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <span>{g.name}</span>
              <span>
                {g.members.length} member{g.members.length === 1 ? "" : "s"}
              </span>
            </List.Item>
          ))}
        </List.Unordered>
      )}
      footer={(
        <Button asChild variant="secondary" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
          <Link to="/manageproperty/usergroups">Manage user groups</Link>
        </Button>
      )}
    />
  )
}
