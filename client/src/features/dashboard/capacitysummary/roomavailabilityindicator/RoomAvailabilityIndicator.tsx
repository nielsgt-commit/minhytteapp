import { Paragraph } from "@digdir/designsystemet-react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import {
  bedAvailabilityForDay,
  type RoomAvailability,
} from "@server/shared/bedOccupancy.ts"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./RoomAvailabilityIndicator.module.css"

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

// Derives availability from the same booking/room queries the calendar card
// uses (shared React Query cache), through the shared bedOccupancy logic, so
// this card can never disagree with the day cards.
export function AvailableBedsToday() {
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const today = Temporal.Now.plainDateISO().toString()
  const availability = bedAvailabilityForDay(rooms, bookings, today)
  return (
    <RoomAvailabilityIndicator
      rooms={availability.rooms}
      unassignedGuests={availability.unassignedGuests}
    />
  )
}
