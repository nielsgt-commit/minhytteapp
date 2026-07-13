import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc"
import type { Temporal } from "temporal-polyfill"
import { type WeekRange, formatRange } from "@/utils/priorityUtils"
import type { SortMode } from "./SummerSummary"
import styles from "./SummerSummary.module.css"

type WeekDay = { iso: string; index: number; name: string }

// The seven days (Mon–Sun) of a priority week, with localized short names.
function weekDays(weekStart: Temporal.PlainDate, locale: string): WeekDay[] {
  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = weekStart.add({ days: i })
    days.push({
      iso: d.toString(),
      index: i,
      name: d.toLocaleString(locale, { weekday: "short" }),
    })
  }
  return days
}

// Collapse consecutive day names into ranges: [Mon, Tue] -> "Mon–Tue",
// [Mon, Thu, Fri] -> "Mon, Thu–Fri".
function formatDays(days: WeekDay[]): string {
  const sorted = [...days].sort((a, b) => a.index - b.index)
  const groups: string[] = []
  let runStart: WeekDay | null = null
  let runEnd: WeekDay | null = null
  const flush = () => {
    if (!runStart || !runEnd) return
    groups.push(
      runStart.index === runEnd.index
        ? runStart.name
        : `${runStart.name}–${runEnd.name}`,
    )
  }
  for (const day of sorted) {
    if (runEnd && day.index === runEnd.index + 1) {
      runEnd = day
    } else {
      flush()
      runStart = day
      runEnd = day
    }
  }
  flush()
  return groups.join(", ")
}

type StayRow = {
  key: string
  roomName: string
  buildingName: string | null
  guests: string[]
  days: WeekDay[]
  firstDay: number
}

export function PriorityWeekSummary({
  propertyId,
  week,
  range,
  sort,
}: {
  propertyId: number
  week: number
  // Resolved by the caller (season-aware for cross-year seasons).
  range: WeekRange
  sort: SortMode
}) {
  const { t, i18n } = useTranslation("dashboard")
  const trpc = useTRPC()

  const days = weekDays(range.start, i18n.language)
  const weekStart = days[0].iso
  const weekEnd = days[6].iso

  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const roomById = new Map(rooms.map(r => [r.id, r]))

  const stays: StayRow[] = []
  for (const b of bookings) {
    if (b.status === "cancelled") continue
    const bStart = b.start_date.toString()
    const bEnd = b.end_date.toString()
    // end_date is inclusive, so the booking occupies [start_date, end_date].
    if (bStart > weekEnd || bEnd < weekStart) continue

    const stayDays = days.filter(d => d.iso >= bStart && d.iso <= bEnd)
    if (stayDays.length === 0) continue

    const guestsByRoom = new Map<number | null, string[]>()
    for (const o of b.occupants) {
      const list = guestsByRoom.get(o.room_id) ?? []
      list.push(o.user_name ?? `#${String(o.user_id)}`)
      guestsByRoom.set(o.room_id, list)
    }
    for (const g of b.guests) {
      const list = guestsByRoom.get(g.room_id) ?? []
      list.push(g.name)
      guestsByRoom.set(g.room_id, list)
    }

    for (const [roomId, guests] of guestsByRoom) {
      const room = roomId == null ? undefined : roomById.get(roomId)
      stays.push({
        key: `${String(b.id)}-${roomId == null ? "none" : String(roomId)}`,
        roomName: room ? room.name : t("Unassigned room"),
        buildingName: room ? room.structure_name : null,
        guests,
        days: stayDays,
        firstDay: stayDays[0].index,
      })
    }
  }

  stays.sort((a, b) => {
    if (sort === "weekday") {
      if (a.firstDay !== b.firstDay) return a.firstDay - b.firstDay
    }
    const buildingCompare = (a.buildingName ?? "").localeCompare(
      b.buildingName ?? "",
    )
    if (buildingCompare !== 0) return buildingCompare
    return a.roomName.localeCompare(b.roomName)
  })

  return (
    <div className={styles.week}>
      <Heading level={3} data-size="xs">
        {t("Week {{weekNumber}}", { weekNumber: week })} ·{" "}
        {formatRange(range, i18n.language)}
      </Heading>
      {stays.length === 0 ? (
        <EmptyState title={t("No stays this week.")} />
      ) : (
        <ul className={styles.cards}>
          {stays.map(s => (
            <Card asChild key={s.key}>
              <li>
                <Card.Block className={styles.row}>
                  <div className={styles.where}>
                    <span className={styles.room}>{s.roomName}</span>
                    {s.buildingName && (
                      <Tag data-size="sm" data-color="neutral">
                        {s.buildingName}
                      </Tag>
                    )}
                  </div>
                  <span className={styles.guests}>{s.guests.join(", ")}</span>
                  <span className={styles.days}>{formatDays(s.days)}</span>
                </Card.Block>
              </li>
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}
