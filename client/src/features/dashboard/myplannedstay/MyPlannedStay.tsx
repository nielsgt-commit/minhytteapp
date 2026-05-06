import { useQuery } from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return aStart <= bEnd && bStart <= aEnd
}

function formatDayMonth(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

export function MyPlannedStay() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: bookings } = useQuery(
    trpc.booking.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  if (selectedPropertyId == null) {
    return (
      <section>
        <h4>My planned stays</h4>
        <p>Select a property to see your stays.</p>
      </section>
    )
  }

  if (!me || !bookings) return <p>Loading…</p>

  const active = bookings.filter(b => b.status !== "cancelled")
  const myBookings = active.filter(b =>
    b.occupants.some(o => o.user_id === me.id),
  )

  return (
    <section>
      <h4>My planned stays</h4>
      {myBookings.length === 0 ? (
        <p>No planned stays yet.</p>
      ) : (
        <ul>
          {myBookings.map(b => {
            const otherNames = new Set<string>()
            for (const other of active) {
              if (!rangesOverlap(b.start_date, b.end_date, other.start_date, other.end_date)) continue
              for (const o of other.occupants) {
                if (o.user_id === me.id) continue
                otherNames.add(o.user_name ?? `#${String(o.user_id)}`)
              }
            }
            const names = Array.from(otherNames)
            return (
              <li key={b.id}>
                {formatDayMonth(b.start_date)} – {formatDayMonth(b.end_date)}
                {names.length > 0 ? (
                  <span> — accompanied by: {names.join(", ")}</span>
                ) : (
                  <span> — solo stay</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}