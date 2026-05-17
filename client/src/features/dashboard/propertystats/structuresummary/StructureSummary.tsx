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

export default function StructureSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const roomCountByStructure = new Map<number, number>()
  for (const r of rooms) {
    roomCountByStructure.set(
      r.structure_id,
      (roomCountByStructure.get(r.structure_id) ?? 0) + 1,
    )
  }

  return (
    <StatCard
      title="Structures"
      count={structures.length}
      content={structures.length === 0 ? (
        <Paragraph>No Structures yet.</Paragraph>
      ) : (
        <List.Unordered style={{ listStyle: "none", padding: 0 }}>
          {structures.map(b => {
            const count = roomCountByStructure.get(b.id) ?? 0
            return (
              <List.Item key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <span>{b.name}</span>
                <span>{count} room{count === 1 ? "" : "s"}</span>
              </List.Item>
            )
          })}
        </List.Unordered>
      )}
      footer={(
        <Button asChild variant="secondary" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
          <Link to="/manageproperty">Manage Structures</Link>
        </Button>
      )}
    />
  )
}
