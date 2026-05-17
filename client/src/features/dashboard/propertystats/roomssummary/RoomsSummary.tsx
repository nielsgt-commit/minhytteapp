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
    <StatCard
      title="Bedrooms"
      count={rooms.length}
      content={rooms.length === 0 ? (
        <Paragraph>No rooms yet.</Paragraph>
      ) : (
        <List.Unordered style={{ listStyle: "none", padding: 0 }}>
          <List.Item style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <span>Beds (single)</span>
            <span>{totals.beds_sm}</span>
          </List.Item>
          <List.Item style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <span>Beds (large)</span>
            <span>{totals.beds_lg}</span>
          </List.Item>
          <List.Item style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <span>Beds (double)</span>
            <span>{totals.beds_double}</span>
          </List.Item>
          <List.Item style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <span>Beds (kid)</span>
            <span>{totals.beds_kid}</span>
          </List.Item>
          <List.Item style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <span>Mattresses</span>
            <span>{totals.mattresses}</span>
          </List.Item>
          <List.Item style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <span>Travel cots</span>
            <span>{totals.travel_cot}</span>
          </List.Item>
        </List.Unordered>
      )}
      footer={(
        <Button asChild variant="secondary" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
          <Link to="/manageproperty">Manage rooms</Link>
        </Button>
      )}
    />
  )
}
