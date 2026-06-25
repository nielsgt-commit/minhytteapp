import { useSelectedPropertyId } from "@/selection/useSelection"
import { useEffect, useState, type CSSProperties } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Paragraph,
  Tag,
  ToggleGroup,
} from "@digdir/designsystemet-react"
import { ChevronLeftIcon, ChevronRightIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./PlannedAvailabilitySummary.module.css"
import { DayCard } from "./DayCard"
import { DaySummary } from "./DaySummary"
import { OccupancyMatrix } from "./OccupancyMatrix"
import { roomGroupsForDay } from "./daySummaryUtils"
import { useTRPC } from "@/trpc/trpc.ts"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { Temporal } from "temporal-polyfill"
import { formatDayMonth, isoWeekNumber, isoWeekYear } from "@/utils/dateUtils"

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
  weekStart: Temporal.PlainDate
  onWeekStartChange: (d: Temporal.PlainDate) => void
}

export function PlannedAvailabilitySummary({
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
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: atProperty } = useSuspenseQuery(
    trpc.stay.atProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: weather } = useQuery(
    trpc.weather.forProperty.queryOptions(
      { property_id: propertyId, week_start: weekStart },
      { staleTime: 10 * 60_000, gcTime: 30 * 60_000 },
    ),
  )
  const forecastByIso = new Map(
    (weather?.days ?? []).map(d => [d.iso.toString(), d]),
  )

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add({ days: i }))
  const thursday = weekStart.add({ days: 4 })
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
    Temporal.Now.plainDateISO().toString(),
  )

  // Desktop view mode. "grid" = week columns + inline row drawer,
  // "rows" = vertical list reusing the mobile inline-expand, "popover" = per-card
  // popover, "matrix" = room×day occupancy grid.
  const [view, setView] = useState<"grid" | "rows" | "popover" | "matrix">(
    "grid",
  )
  const usePopover = !isMobile && view === "popover"
  const useRows = !isMobile && view === "rows"
  const useMatrix = !isMobile && view === "matrix"
  const expandInline = isMobile || useRows

  useEffect(() => {
    const todayIso = Temporal.Now.plainDateISO().toString()
    const visible = Array.from({ length: 7 }, (_, i) =>
      weekStart.add({ days: i }).toString(),
    )
    if (visible.includes(todayIso)) {
      setSelectedDay(todayIso)
      return
    }
    const active = bookings.filter(b => b.status !== "cancelled")
    const firstWithGuests = visible.find(iso =>
      active.some(
        b =>
          iso >= b.start_date.toString() &&
          iso <= b.end_date.toString() &&
          b.occupants.length > 0,
      ),
    )
    setSelectedDay(firstWithGuests ?? null)
  }, [weekStart, bookings])

  const hasForecast = (weather?.days.length ?? 0) > 0

  const propertyBookings = bookings.filter(b => b.status !== "cancelled")

  const guestsOnDay = (iso: string) => {
    let count = 0
    for (const b of propertyBookings) {
      if (iso >= b.start_date.toString() && iso <= b.end_date.toString()) {
        count += b.occupants.length
      }
    }
    return count
  }

  const roomById = new Map(rooms.map(r => [r.id, r]))

  const roomGroupsOnDay = (iso: string) =>
    roomGroupsForDay(propertyBookings, roomById, iso, t("Unassigned room"))

  const selectedGroups =
    !isMobile && selectedDay ? roomGroupsOnDay(selectedDay) : []

  const selectedIndex = selectedDay
    ? days.findIndex(d => d.toString() === selectedDay)
    : -1
  const selectedDate = selectedIndex >= 0 ? days[selectedIndex] : null

  const userById = new Map(users.map(u => [u.id, u]))

  const todayIso = Temporal.Now.plainDateISO().toString()

  const birthdayGuestsOnDay = (iso: string) => {
    const seen = new Map<number, string>()
    for (const b of propertyBookings) {
      if (iso < b.start_date.toString() || iso > b.end_date.toString()) continue
      for (const o of b.occupants) {
        const u = userById.get(o.user_id)
        if (!u?.birthday) continue
        if (u.birthday.toString().slice(5) !== iso.slice(5)) continue
        if (seen.has(o.user_id)) continue
        seen.set(o.user_id, u.name)
      }
    }
    if (iso === todayIso) {
      for (const p of atProperty) {
        const u = userById.get(p.user_id)
        if (!u?.birthday) continue
        if (u.birthday.toString().slice(5) !== iso.slice(5)) continue
        if (seen.has(p.user_id)) continue
        seen.set(p.user_id, u.name)
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
  }

  const weekBirthdayGuests = (() => {
    const seen = new Map<number, string>()
    for (const d of days) {
      for (const g of birthdayGuestsOnDay(d.toString())) {
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
              onWeekStartChange(weekStart.subtract({ days: 7 }))
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
              onWeekStartChange(weekStart.add({ days: 7 }))
            }}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
        <div className={styles.weekNavRight}>
          {!isMobile && (
            <ToggleGroup
              value={view}
              onChange={value => {
                setView(value as "grid" | "rows" | "popover" | "matrix")
              }}
              data-size="sm"
              data-toggle-group={t("Day view")}
            >
              <ToggleGroup.Item value="grid">{t("Grid")}</ToggleGroup.Item>
              <ToggleGroup.Item value="rows">{t("Rows")}</ToggleGroup.Item>
              <ToggleGroup.Item value="popover">
                {t("Popover")}
              </ToggleGroup.Item>
              <ToggleGroup.Item value="matrix">{t("Matrix")}</ToggleGroup.Item>
            </ToggleGroup>
          )}
          {weekBirthdayGuests.map(g => (
            <Tag key={g.id} data-color="warning">
              {t("{{name}} birthday", { name: g.name })}
            </Tag>
          ))}
          {priorityHolderName && <Tag>{priorityHolderName}</Tag>}
        </div>
      </div>
      <div className="calendar-week-chips"></div>

      {useMatrix ? (
        <OccupancyMatrix
          days={days}
          bookings={propertyBookings}
          rooms={rooms}
        />
      ) : (
        <>
          <ul
            className={`${styles.dayList}${useRows ? ` ${styles.rowsView}` : ""}`}
          >
            {isMobile &&
            !hasForecast &&
            days.every(d => guestsOnDay(d.toString()) === 0) ? (
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
                const iso = d.toString()
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
                    groups={roomGroupsOnDay(iso)}
                    expandInline={expandInline}
                    popover={usePopover}
                    buildingDividers={useRows}
                    forecast={forecastByIso.get(iso)}
                    onToggle={toggle}
                  />
                )
              })
            )}
          </ul>
          {!isMobile &&
            view === "grid" &&
            selectedDate &&
            selectedIndex >= 0 &&
            selectedGroups.length > 0 && (
              <Card asChild>
                <section
                  className={styles.dayPanel}
                  style={{ "--col": selectedIndex } as CSSProperties}
                >
                  <span className={styles.dayPanelArrow} aria-hidden />
                  <Card.Block>
                    <Paragraph
                      data-size="sm"
                      className={styles.dayPanelHeader}
                      aria-live="polite"
                    >
                      <strong>{t(WEEKDAY_LABELS[selectedIndex])}</strong>{" "}
                      {formatDayMonth(selectedDate)}
                    </Paragraph>
                    <DaySummary groups={selectedGroups} buildingDividers />
                  </Card.Block>
                </section>
              </Card>
            )}
        </>
      )}
    </div>
  )
}
