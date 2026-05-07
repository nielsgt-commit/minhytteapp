import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  Badge,
  Button,
  Heading,
  List,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"

export default function UserSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: userGroups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  return (
    <>
      <Heading level={4}>
        User groups <Badge count={userGroups.length} />
      </Heading>
      {userGroups.length === 0 ? (
        <Paragraph>No user groups yet.</Paragraph>
      ) : (
        <List.Unordered style={{ listStyle: "none", padding: 0 }}>
          {userGroups.map(g => (
            <List.Item key={g.id}>
              {g.name} – {g.members.length} member
              {g.members.length === 1 ? "" : "s"}
            </List.Item>
          ))}
        </List.Unordered>
      )}
      <Button asChild variant="secondary">
        <Link to="/usergroups">Manage user groups</Link>
      </Button>
    </>
  )
}