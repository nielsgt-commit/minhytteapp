import { useQuery } from "@tanstack/react-query"
import {
  Avatar,
  EXPERIMENTAL_AvatarStack as AvatarStack,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? "")
    .join("")
}

export default function AtPropertyNow() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId)
  const { data, isLoading } = useQuery(
    trpc.stay.atProperty.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled: propertyId != null },
    ),
  )

  if (propertyId == null) return null
  if (isLoading) return <p>Loading…</p>

  const guests = data ?? []
  if (guests.length === 0) return <p>No one at the property right now.</p>

  return (
    <AvatarStack aria-label="At property now" expandable overlap={8}>
      {guests.map(g => (
        <Avatar
          key={g.user_id}
          aria-label={g.name}
          data-initials={initials(g.name)}
        />
      ))}
    </AvatarStack>
  )
}
