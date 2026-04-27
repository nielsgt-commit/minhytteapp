import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

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
      <h1>User groups ({userGroups.length})</h1>
      {userGroups.length === 0 ? (
        <p>No user groups yet.</p>
      ) : (
        <ul>
          {userGroups.map(g => (
            <li key={g.id}>
              {g.name} – {g.members.length} member
              {g.members.length === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
      )}
      <Link to="/usergroups">Manage user groups</Link>
    </>
  )
}