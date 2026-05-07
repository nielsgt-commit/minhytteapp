import { Heading, Tag } from "@digdir/designsystemet-react"

type RoomBeds = {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

type Room = RoomBeds & {
  building_id: number
  building_name?: string | null
}

function totalBeds(r: RoomBeds) {
  return (
    r.beds_sm +
    r.beds_lg +
    r.beds_double * 2 +
    r.beds_kid +
    r.mattresses +
    r.travel_cot
  )
}

function availabilityColor(
  available: number,
  total: number,
): "success" | "warning" | "danger" {
  if (available <= 1) return "danger"
  if (available < total / 2) return "warning"
  return "success"
}

export default function RoomAvailabilityIndicator({
  rooms,
}: {
  rooms: Room[]
}) {
  return (
    <>
    <Heading level={6} size="medium">Available beds</Heading>
    <ul
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        listStyle: "none",
        padding: 0,
      }}
    >
      {Array.from(
        rooms.reduce((acc, r) => {
          const prev = acc.get(r.building_id)
          acc.set(r.building_id, {
            name: r.building_name ?? `Building #${String(r.building_id)}`,
            beds: (prev?.beds ?? 0) + totalBeds(r),
          })
          return acc
        }, new Map<number, { name: string; beds: number }>()),
      ).map(([id, b]) => {
        const available = b.beds
        return (
          <Tag key={id} data-color={availabilityColor(available, b.beds)}>
            {b.name}
          </Tag>
        )
      })}
    </ul>
  </>
      )
}