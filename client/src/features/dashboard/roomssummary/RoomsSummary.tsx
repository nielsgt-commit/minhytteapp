import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

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
      <h1>Rooms ({rooms.length})</h1>
      {rooms.length === 0 ? (
        <p>No rooms yet.</p>
      ) : (
        <ul>
          <li>Beds (single) – {totals.beds_sm}</li>
          <li>Beds (large) – {totals.beds_lg}</li>
          <li>Beds (double) – {totals.beds_double}</li>
          <li>Beds (kid) – {totals.beds_kid}</li>
          <li>Mattresses – {totals.mattresses}</li>
          <li>Travel cots – {totals.travel_cot}</li>
        </ul>
      )}
      <Link to="/manageproperty">Manage rooms</Link>
    </>
  )
}