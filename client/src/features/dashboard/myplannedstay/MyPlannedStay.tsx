import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, Tag } from "@digdir/designsystemet-react"
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
  const selectedPropertyId = useSelectedPropertyId()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: bookings } = useQuery(
    trpc.booking.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const [openId, setOpenId] = useState<number | null>(null)

  if (selectedPropertyId == null) {
    return <p>Select a property to see your stays.</p>
  }

  if (!me || !bookings) return <p>Loading…</p>

  const active = bookings.filter(b => b.status !== "cancelled")
  const myBookings = active.filter(b =>
    b.occupants.some(o => o.user_id === me.id),
  )

  if (myBookings.length === 0) {
    return <p>No planned stays yet.</p>
  }

  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
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
        const isOpen = openId === b.id
        const toggle = () => { setOpenId(prev => (prev === b.id ? null : b.id)) }
        return (
          <Card asChild key={b.id}>
            <li>
              <Card.Block
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={toggle}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggle()
                  }
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  cursor: "pointer",
                }}
              >
                <div>
                  {formatDayMonth(b.start_date)} – {formatDayMonth(b.end_date)}
                </div>
                {isOpen && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {names.length > 0 ? (
                      <>
                        <span>Accompanied by:</span>
                        {names.map(n => (
                          <Tag key={n} data-color="info">{n}</Tag>
                        ))}
                      </>
                    ) : (
                      <span>Solo stay</span>
                    )}
                  </div>
                )}
              </Card.Block>
            </li>
          </Card>
        )
      })}
    </ul>
  )
}