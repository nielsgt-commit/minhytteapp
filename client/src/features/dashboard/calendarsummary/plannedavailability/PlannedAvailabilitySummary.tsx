import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useEffect, useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card, Paragraph, Tag } from "@digdir/designsystemet-react"
import { ChevronLeftIcon, ChevronRightIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./PlannedAvailabilitySummary.module.css"
import DayCard from "./DayCard"
import { useTRPC } from "@/trpc/trpc.ts"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { addDays, isoWeekNumber, isoWeekYear, toIso } from "@/utils/dateUtils"

const WEEKDAY_LABELS = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const

type Props = {
  weekStart: Date
  onWeekStartChange: (d: Date) => void
}

export default function PlannedAvailabilitySummary({
  weekStart,
  onWeekStartChange,
}: Props) {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const isMobile = useIsMobile()
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: atProperty } = useSuspenseQuery(
    trpc.stay.atProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: weather } = useQuery(
    trpc.weather.forProperty.queryOptions(
      { property_id: propertyId, week_start: toIso(weekStart) },
      { staleTime: 10 * 60_000, gcTime: 30 * 60_000 },
    ),
  )
  const forecastByIso = new Map((weather?.days ?? []).map(d => [d.iso, d]))

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
      x => x.user_group_id === a.user_group_id,
    )
    return o?.user_group_name ?? null
  })()

  const [selectedDay, setSelectedDay] = useState<string | null>(() =>
    toIso(new Date()),
  )

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
        b => iso >= b.start_date && iso <= b.end_date && b.occupants.length > 0,
      ),
    )
    setSelectedDay(firstWithGuests ?? null)
  }, [weekStart, bookings])

  const hasForecast = (weather?.days?.length ?? 0) > 0

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
            aria-label={t("Previous week")}
            onClick={() => {
              onWeekStartChange(addDays(weekStart, -7))
            }}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Paragraph>{t("Week {{weekNumber}}", { weekNumber })}</Paragraph>
          <Button
            variant="tertiary"
            icon
            aria-label={t("Next week")}
            onClick={() => {
              onWeekStartChange(addDays(weekStart, 7))
            }}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
        <div className={styles.weekNavRight}>
          {weekBirthdayGuests.map(g => (
            <Tag key={g.id} data-color="warning">
              {t("{{name}} birthday", { name: g.name })}
            </Tag>
          ))}
          {priorityHolderName && <Tag>{priorityHolderName}</Tag>}
        </div>
      </div>
      <div className="calendar-week-chips"></div>

      <ul className={styles.dayList}>
        {isMobile &&
        !hasForecast &&
        days.every(d => guestsOnDay(toIso(d)) === 0) ? (
          <Card asChild>
            <li>
              <Card.Block
                className={`${styles.dayCardBlock} ${styles.dayCardBlockEmpty}`}
              >
                <div className={styles.dayRow}>
                  <div className={styles.dayCount}>
                    <span>{t("No guests")}</span>
                  </div>
                </div>
              </Card.Block>
            </li>
          </Card>
        ) : (
          days.map((d, i) => {
            const iso = toIso(d)
            const isSelected = selectedDay === iso
            const count = guestsOnDay(iso)
            const toggle = () => {
              if (count === 0) return
              setSelectedDay(isSelected ? null : iso)
            }
            return (
              <DayCard
                key={iso}
                date={d}
                weekdayLabel={WEEKDAY_LABELS[i]}
                iso={iso}
                isSelected={isSelected}
                isToday={iso === todayIso}
                hasBirthday={birthdayGuestsOnDay(iso).length > 0}
                count={count}
                names={guestNamesOnDay(iso)}
                forecast={forecastByIso.get(iso)}
                onToggle={toggle}
              />
            )
          })
        )}
      </ul>
    </div>
  )
}
