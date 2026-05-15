import { useEffect, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  Paragraph,
  Tag,
} from "@digdir/designsystemet-react"
import { ChevronLeftIcon, ChevronRightIcon } from "@navikt/aksel-icons"
import styles from "./PlannedAvailabilitySummary.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useIsMobile } from "@/hooks/useIsMobile.ts"

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toIso(d: Date) {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfSunday(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

function addDays(d: Date, n: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function isoWeekNumber(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function isoWeekYear(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  return t.getUTCFullYear()
}

type Props = {
  weekStart: Date
  onWeekStartChange: (d: Date) => void
}

export default function PlannedAvailabilitySummary({
  weekStart,
  onWeekStartChange,
}: Props) {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const isMobile = useIsMobile()
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: users } = useSuspenseQuery(
    trpc.user.list.queryOptions(),
  )
  const { data: atProperty } = useSuspenseQuery(
    trpc.stay.atProperty.queryOptions({ property_id: propertyId }),
  )

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const thursday = addDays(weekStart, 4)
  const weekNumber = isoWeekNumber(thursday)
  const weekYear = isoWeekYear(thursday)

  const { data: priority } = useSuspenseQuery(
    trpc.priority.list.queryOptions({
      property_id: propertyId,
      year: weekYear,
    }),
  )
  const priorityHolderName = (() => {
    const a = priority.assignments.find(x => x.iso_week === weekNumber)
    if (!a) return null
    const o = priority.eligibleOwners.find(
      x => x.property_owner_id === a.property_owner_id,
    )
    return o?.user_name ?? null
  })()

  const [selectedDay, setSelectedDay] = useState<string | null>(() => toIso(new Date()))

  useEffect(() => {
    const todayIso = toIso(new Date())
    const visible = Array.from({ length: 7 }, (_, i) =>
      toIso(addDays(weekStart, i)),
    )
    if (visible.includes(todayIso)) {
      setSelectedDay(todayIso)
      return
    }
    const active = bookings.filter(b => b.status !== "cancelled")
    const firstWithGuests = visible.find(iso =>
      active.some(
        b =>
          iso >= b.start_date && iso <= b.end_date && b.occupants.length > 0,
      ),
    )
    setSelectedDay(firstWithGuests ?? null)
  }, [weekStart, bookings])

  const propertyBookings = bookings.filter(b => b.status !== "cancelled")

  const guestsOnDay = (iso: string) => {
    let count = 0
    for (const b of propertyBookings) {
      if (iso >= b.start_date && iso <= b.end_date) {
        count += b.occupants.length
      }
    }
    return count
  }

  const guestNamesOnDay = (iso: string) => {
    const seen = new Map<number, string>()
    for (const b of propertyBookings) {
      if (iso >= b.start_date && iso <= b.end_date) {
        for (const o of b.occupants) {
          if (!seen.has(o.user_id) && o.user_name) {
            seen.set(o.user_id, o.user_name)
          }
        }
      }
    }
    return Array.from(seen.values())
  }

  const userById = new Map(users.map(u => [u.id, u]))

  const todayIso = toIso(new Date())

  const birthdayGuestsOnDay = (iso: string) => {
    const seen = new Map<number, string>()
    for (const b of propertyBookings) {
      if (iso < b.start_date || iso > b.end_date) continue
      for (const o of b.occupants) {
        const u = userById.get(o.user_id)
        if (!u?.birthday) continue
        if (u.birthday.slice(5) !== iso.slice(5)) continue
        if (seen.has(o.user_id)) continue
        seen.set(o.user_id, u.name)
      }
    }
    if (iso === todayIso) {
      for (const p of atProperty) {
        const u = userById.get(p.user_id)
        if (!u?.birthday) continue
        if (u.birthday.slice(5) !== iso.slice(5)) continue
        if (seen.has(p.user_id)) continue
        seen.set(p.user_id, u.name)
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
  }

  const weekBirthdayGuests = (() => {
    const seen = new Map<number, string>()
    for (const d of days) {
      for (const g of birthdayGuestsOnDay(toIso(d))) {
        if (!seen.has(g.id)) seen.set(g.id, g.name)
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
  })()

  return (
    <div className={styles.wrap}>
      <div className={styles.weekNav}>
        <div className={styles.weekNavLeft}>
          <Button
            variant="tertiary"
            icon
            aria-label="Previous week"
            onClick={() => { onWeekStartChange(addDays(weekStart, -7)) }}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Paragraph>Week {weekNumber}</Paragraph>
          <Button
            variant="tertiary"
            icon
            aria-label="Next week"
            onClick={() => { onWeekStartChange(addDays(weekStart, 7)) }}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
        <div className={styles.weekNavRight}>
          {weekBirthdayGuests.map(g => (
            <Tag key={g.id} data-color="warning">{g.name} birthday</Tag>
          ))}
          {priorityHolderName && <Tag>{priorityHolderName}</Tag>}
        </div>
      </div>
      <div className="calendar-week-chips"></div>

      <ul className={styles.dayList}>
        {isMobile && days.every(d => guestsOnDay(toIso(d)) === 0) ? (
          <Card asChild>
            <li>
              <Card.Block className={styles.dayCardBlock} style={{ cursor: "default" }}>
                <div className={styles.dayRow}>
                  <div className={styles.dayCount}>
                    <span>No guests</span>
                  </div>
                </div>
              </Card.Block>
            </li>
          </Card>
        ) : days.map((d, i) => {
          const iso = toIso(d)
          const isSelected = selectedDay === iso
          const isToday = iso === todayIso
          const hasBirthday = birthdayGuestsOnDay(iso).length > 0
          const names = guestNamesOnDay(iso)
          const count = guestsOnDay(iso)
          const isClickable = count > 0
          const toggle = () => {
            if (!isClickable) return
            setSelectedDay(isSelected ? null : iso)
          }
          return (
            <Card asChild key={iso}>
              <li>
                <Card.Block
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-expanded={isClickable ? isSelected : undefined}
                  onClick={isClickable ? toggle : undefined}
                  onKeyDown={isClickable ? e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggle()
                    }
                  } : undefined}
                  className={styles.dayCardBlock}
                  style={isClickable ? undefined : { cursor: "default" }}
                >
                  <div className={styles.dayRow}>
                    <div className={styles.dayLabel}>
                      {hasBirthday ? (
                        <Badge.Position placement="top-right">
                          <Badge data-color="warning" />
                          <span>
                            <strong>{WEEKDAY_LABELS[i]}</strong>{" "}
                            {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                            {isToday && " · Today"}
                          </span>
                        </Badge.Position>
                      ) : (
                        <span>
                          <strong>{WEEKDAY_LABELS[i]}</strong>{" "}
                          {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                          {isToday && " · Today"}
                        </span>
                      )}
                    </div>
                    <div className={styles.dayCount}>
                      {count > 0 ? (
                        <strong>
                          {count} guest{count === 1 ? "" : "s"}
                        </strong>
                      ) : (
                        <span>No guests</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className={styles.guestList}>
                      {names.length > 0 ? (
                        names.map(n => (
                          <Tag key={n} data-color="info">{n}</Tag>
                        ))
                      ) : (
                        <Paragraph>No guests</Paragraph>
                      )}
                    </div>
                  )}
                </Card.Block>
              </li>
            </Card>
          )
        })}
      </ul>
    </div>
  )
}
