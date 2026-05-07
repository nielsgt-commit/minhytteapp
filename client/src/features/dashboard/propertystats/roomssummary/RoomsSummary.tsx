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

export default function RoomsSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const totals = rooms.reduce(
    (acc, r) => {
      acc.beds_sm += r.beds_sm
      acc.beds_lg += r.beds_lg
      acc.beds_double += r.beds_double
      acc.beds_kid += r.beds_kid
      acc.mattresses += r.mattresses
      acc.travel_cot += r.travel_cot
      return acc
    },
    {
      beds_sm: 0,
      beds_lg: 0,
      beds_double: 0,
      beds_kid: 0,
      mattresses: 0,
      travel_cot: 0,
    },
  )

  return (
    <>
      <Heading level={4}>
        Bedrooms <Badge count={rooms.length} />
      </Heading>
      {rooms.length === 0 ? (
        <Paragraph>No rooms yet.</Paragraph>
      ) : (
        <List.Unordered style={{ listStyle: "none", padding: 0 }}>
          <List.Item>Beds (single) – {totals.beds_sm}</List.Item>
          <List.Item>Beds (large) – {totals.beds_lg}</List.Item>
          <List.Item>Beds (double) – {totals.beds_double}</List.Item>
          <List.Item>Beds (kid) – {totals.beds_kid}</List.Item>
          <List.Item>Mattresses – {totals.mattresses}</List.Item>
          <List.Item>Travel cots – {totals.travel_cot}</List.Item>
        </List.Unordered>
      )}
      <Button asChild variant="secondary">
        <Link to="/manageproperty">Manage rooms</Link>
      </Button>
    </>
  )
}