import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Avatar,
  EXPERIMENTAL_AvatarStack as AvatarStack,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

const MOBILE_LIMIT = 4

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
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  if (propertyId == null) return null
  if (isLoading) return <p>Loading…</p>

  const guests = data ?? []
  if (guests.length === 0) return <p>No one at the property right now.</p>

  const canTruncate = isMobile && guests.length > MOBILE_LIMIT
  const collapsed = canTruncate && !expanded
  const hiddenCount = collapsed ? guests.length - MOBILE_LIMIT : 0
  const toggle = () => { setExpanded(e => !e) }

  if (collapsed) {
    return (
      <AvatarStack
        aria-label="At property now"
        overlap={8}
        suffix={`+${String(hiddenCount)}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggle()
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={false}
        style={{ cursor: "pointer" }}
      >
        {guests.slice(0, MOBILE_LIMIT).map(g => (
          <Avatar
            key={g.user_id}
            aria-label={g.name}
            data-initials={initials(g.name)}
          />
        ))}
      </AvatarStack>
    )
  }

  if (canTruncate) {
    return (
      <div
        aria-label="At property now"
        role="button"
        tabIndex={0}
        aria-expanded
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggle()
          }
        }}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          cursor: "pointer",
        }}
      >
        {guests.map(g => (
          <Avatar
            key={g.user_id}
            aria-label={g.name}
            data-initials={initials(g.name)}
          />
        ))}
      </div>
    )
  }

  return (
    <AvatarStack aria-label="At property now" overlap={8}>
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