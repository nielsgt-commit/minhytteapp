import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Chip,
  Details,
  Tag,
} from "@digdir/designsystemet-react"
import { ChevronLeftIcon, ChevronRightIcon } from "@navikt/aksel-icons"
import styles from "./PlannedAvailabilitySummaryStacked.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toIso(d: Date) {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
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

export default function PlannedAvailabilitySummaryStacked({
  weekStart,
  onWeekStartChange,
}: Props) {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: users } = useSuspenseQuery(
    trpc.user.list.queryOptions(),
  )
  const { data: atProperty } = useSuspenseQuery(
    trpc.stay.atProperty.queryOptions({ property_id: propertyId }),
  )

  const [expandedDay, setExpandedDay] = useState<string | null>(null)

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

  const propertyBookings = bookings.filter(b => b.status !== "cancelled")

  const guestsOnDay = (iso: string) => {
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
    return Array.from(seen, ([user_id, name]) => ({ user_id, name }))
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

  const stopAndCall = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fn()
  }

  return (
    <div className={styles.wrap}>
      <Details defaultOpen>
        <Details.Summary>
          <span className={styles.summary}>
            <Button
              variant="tertiary"
              icon
              aria-label="Previous week"
              onClick={stopAndCall(() => { onWeekStartChange(addDays(weekStart, -7)) })}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <span>Week {weekNumber}</span>
            <Button
              variant="tertiary"
              icon
              aria-label="Next week"
              onClick={stopAndCall(() => { onWeekStartChange(addDays(weekStart, 7)) })}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </span>
        </Details.Summary>
        <Details.Content>
          {(priorityHolderName || weekBirthdayGuests.length > 0) && (
            <div className={styles.tagsRow}>
              {priorityHolderName && <Tag>{priorityHolderName}</Tag>}
              {weekBirthdayGuests.map(g => (
                <Tag key={g.id} data-color="warning">{g.name} birthday</Tag>
              ))}
            </div>
          )}
          <ul className={styles.list}>
            {days.map((d, i) => {
              const iso = toIso(d)
              const guests = guestsOnDay(iso)
              const isExpanded = expandedDay === iso
              const namesText = guests.map(g => g.name).join(", ")
              return (
                <li key={iso} className={styles.row}>
                  <div className={styles.head}>
                    <div className={styles.label}>
                      <span className={styles.weekday}>{WEEKDAY_LABELS[i]}</span>
                      <span className={styles.date}>
                        {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                      </span>
                    </div>
                    {guests.length > 0 ? (
                      <>
                        <span className={styles.names}>{namesText}</span>
                        <Chip.Button
                          className={styles.chip}
                          aria-expanded={isExpanded}
                          onClick={() => {
                            setExpandedDay(isExpanded ? null : iso)
                          }}
                        >
                          {guests.length}
                        </Chip.Button>
                      </>
                    ) : (
                      <span className={styles.empty}>No guests</span>
                    )}
                  </div>
                  {guests.length > 0 && isExpanded && (
                    <div className={styles.mobileNames}>{namesText}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </Details.Content>
      </Details>
    </div>
  )
}
