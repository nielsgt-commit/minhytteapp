import { Paragraph } from "@digdir/designsystemet-react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./RoomAvailabilityIndicator.module.css"

type RoomAvailability = {
  room_id: number
  name: string
  structure_id: number
  structure_name: string | null
  capacity: number
  occupied: number
  available: number
}

export function RoomAvailabilityIndicator({
  rooms,
  unassignedGuests,
}: {
  rooms: RoomAvailability[]
  unassignedGuests: number
}) {
  const { t } = useTranslation("dashboard")

  if (rooms.length === 0) return <EmptyState title={t("No rooms yet.")} />

  const totalAvailable = rooms.reduce((sum, r) => sum + r.available, 0)
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0)

  const structures = Array.from(
    rooms.reduce((acc, r) => {
      const prev = acc.get(r.structure_id)
      if (prev) {
        prev.rooms.push(r)
      } else {
        acc.set(r.structure_id, {
          name:
            r.structure_name ??
            t("Structure #{{id}}", { id: String(r.structure_id) }),
          rooms: [r],
        })
      }
      return acc
    }, new Map<number, { name: string; rooms: RoomAvailability[] }>()),
  )

  return (
    <div className={styles.stack}>
      <Paragraph data-size="sm">
        {t("{{available}} of {{capacity}} beds available", {
          available: totalAvailable,
          capacity: totalCapacity,
        })}
      </Paragraph>
      {structures.map(([id, s]) => (
        <div key={id} className={styles.structure}>
          {structures.length > 1 && (
            <Paragraph data-size="xs" className={styles.structureName}>
              {s.name}
            </Paragraph>
          )}
          <ul className={styles.list}>
            {s.rooms.map(r => (
              <li key={r.room_id}>
                {r.name} {r.available}/{r.capacity}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {unassignedGuests > 0 && (
        <Paragraph data-size="xs" className={styles.unassigned}>
          {t("{{count}} guest without a room", { count: unassignedGuests })}
        </Paragraph>
      )}
    </div>
  )
}

// Fetches its own availability so a slow/failing query only affects this card.
export function AvailableBedsToday() {
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data } = useSuspenseQuery(
    trpc.booking.bedAvailabilityToday.queryOptions({ property_id: propertyId }),
  )
  return (
    <RoomAvailabilityIndicator
      rooms={data.rooms}
      unassignedGuests={data.unassignedGuests}
    />
  )
}
