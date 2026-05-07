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

export default function BuildingSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: buildings } = useSuspenseQuery(
    trpc.building.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const roomCountByBuilding = new Map<number, number>()
  for (const r of rooms) {
    roomCountByBuilding.set(
      r.building_id,
      (roomCountByBuilding.get(r.building_id) ?? 0) + 1,
    )
  }

  return (
    <>
      <Heading level={4}>
        Buildings <Badge count={buildings.length} />
      </Heading>
      {buildings.length === 0 ? (
        <Paragraph>No buildings yet.</Paragraph>
      ) : (
        <List.Unordered style={{ listStyle: "none", padding: 0 }}>
          {buildings.map(b => {
            const count = roomCountByBuilding.get(b.id) ?? 0
            return (
              <List.Item key={b.id}>
                {b.name} – {count} room{count === 1 ? "" : "s"}
              </List.Item>
            )
          })}
        </List.Unordered>
      )}
      <Button asChild variant="secondary">
        <Link to="/manageproperty">Manage buildings</Link>
      </Button>
    </>
  )
}