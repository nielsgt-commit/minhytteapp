import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

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

       <ul style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0 }}>
          {guests.map(g => (
            <li key={g.user_id}>
              {g.name}
              {g.via === "stay" && " (checked in)"}
              {g.via === "both" && " (booking + checked in)"}
            </li>
          ))}
       </ul>
  )
}
