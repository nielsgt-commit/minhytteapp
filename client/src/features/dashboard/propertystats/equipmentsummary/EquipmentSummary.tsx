import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  Badge,
  Button,
  Card,
  Divider,
  Heading,
  List,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"

const CATEGORIES = ["Boat", "Appliance", "Tool"] as const

export default function EquipmentSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: equipment } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const countByCategory = new Map<string, number>(
    CATEGORIES.map(c => [c, 0]),
  )
  for (const item of equipment) {
    const raw = item.category?.trim()
    if (!raw) continue
    const match = CATEGORIES.find(c => c.toLowerCase() === raw.toLowerCase())
    if (!match) continue
    countByCategory.set(match, (countByCategory.get(match) ?? 0) + 1)
  }

  return (
    <Card asChild>
      <section style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Card.Block style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <Heading level={4} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <span>Equipment</span>
            <Badge count={CATEGORIES.length} />
          </Heading>
          <Divider />
          {equipment.length === 0 ? (
            <Paragraph>No equipment yet.</Paragraph>
          ) : (
            <List.Unordered style={{ listStyle: "none", padding: 0 }}>
              {CATEGORIES.map(cat => {
                const count = countByCategory.get(cat) ?? 0
                return (
                  <List.Item key={cat} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span>{cat}</span>
                    <span>{count}</span>
                  </List.Item>
                )
              })}
            </List.Unordered>
          )}
          <Button asChild variant="secondary" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
            <Link to="/manageproperty">Manage equipment</Link>
          </Button>
        </Card.Block>
      </section>
    </Card>
  )
}