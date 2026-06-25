import { Fragment, useMemo } from "react"
import { Card, Paragraph } from "@digdir/designsystemet-react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { useTRPC } from "@/trpc/trpc.ts"
import { groupColor } from "@/features/usergroups/groupColors"
import { YEAR } from "../constants.ts"
import styles from "./StaySummaryCompact.module.css"

// No family group → a neutral bar, matching the calendar dots.
const NO_GROUP_COLOR = "var(--ds-color-neutral-base-default)"

// The axis is capped to the two focus months, June and July. Stays bleeding
// into May or August are clipped at the edges; the adjacent month names are
// still shown in the side gutters for context.
const FOCUS_START = Temporal.PlainDate.from({ year: YEAR, month: 6, day: 1 })
const FOCUS_END = Temporal.PlainDate.from({ year: YEAR, month: 8, day: 1 }) // exclusive
const SPAN_DAYS = FOCUS_START.until(FOCUS_END).days

// Fraction 0..1 of where a date sits across the focus window.
function fraction(date: Temporal.PlainDate): number {
  const d = FOCUS_START.until(date).days / SPAN_DAYS
  return Math.max(0, Math.min(1, d))
}

function pct(date: Temporal.PlainDate): string {
  return `${String(fraction(date) * 100)}%`
}

type Bar = {
  bookingId: number
  start: Temporal.PlainDate
  end: Temporal.PlainDate
  queued: boolean
}

type Lane = {
  userId: number
  name: string
  // Family-group id for this person (0 = no family group), drives bar color.
  groupId: number
  bars: Bar[]
}

export function StaySummaryCompact({ propertyId }: { propertyId: number }) {
  const { t, i18n } = useTranslation("planstay")
  const trpc = useTRPC()

  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: userGroups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  // user_id → family-group id, mirroring the calendar dots' coloring.
  const familyGroupByUser = useMemo(() => {
    const map = new Map<number, number>()
    for (const g of userGroups) {
      if (!g.is_family) continue
      for (const m of g.members) map.set(m.user_id, g.id)
    }
    return map
  }, [userGroups])

  const lanes = useMemo<Lane[]>(() => {
    const byUser = new Map<number, Lane>()
    for (const b of bookings) {
      if (b.status === "cancelled") continue
      // Skip bookings entirely outside the focus window (June–July).
      if (
        Temporal.PlainDate.compare(b.end_date, FOCUS_START) < 0 ||
        Temporal.PlainDate.compare(b.start_date, FOCUS_END) >= 0
      )
        continue
      for (const o of b.occupants) {
        let lane = byUser.get(o.user_id)
        if (!lane) {
          lane = {
            userId: o.user_id,
            name: o.user_name ?? `#${String(o.user_id)}`,
            groupId: familyGroupByUser.get(o.user_id) ?? 0,
            bars: [],
          }
          byUser.set(o.user_id, lane)
        }
        lane.bars.push({
          bookingId: b.id,
          start: b.start_date,
          end: b.end_date,
          queued: o.queued,
        })
      }
    }
    // Group families together, then alphabetical within a group.
    return [...byUser.values()].sort(
      (a, b) => a.groupId - b.groupId || a.name.localeCompare(b.name),
    )
  }, [bookings, familyGroupByUser])

  // Legend: one chip per family group that actually appears in the chart,
  // plus an "Other" chip when ungrouped people have stays. Order matches the
  // lane sort (group id), so chips line up with the bands above.
  const legend = useMemo(() => {
    const nameById = new Map<number, string>()
    for (const g of userGroups) nameById.set(g.id, g.name)

    const seen = new Set<number>()
    const out: { key: string; label: string; color: string }[] = []
    for (const lane of lanes) {
      if (seen.has(lane.groupId)) continue
      seen.add(lane.groupId)
      if (lane.groupId > 0) {
        out.push({
          key: String(lane.groupId),
          label: nameById.get(lane.groupId) ?? `#${String(lane.groupId)}`,
          color: groupColor(lane.groupId),
        })
      } else {
        out.push({ key: "none", label: t("Other"), color: NO_GROUP_COLOR })
      }
    }
    return out
  }, [lanes, userGroups, t])

  // Dotted dividers sit on each month boundary within the focus window
  // (Jun 1 at the left edge, Jul 1 in the middle, Aug 1 at the right edge);
  // each carries the name of the month that begins there, to its right.
  const boundaries = useMemo(() => {
    const out: { date: Temporal.PlainDate; label: string }[] = []
    for (let m = FOCUS_START.month; m <= FOCUS_END.month; m++) {
      const date = Temporal.PlainDate.from({ year: YEAR, month: m, day: 1 })
      out.push({
        date,
        label: date.toLocaleString(i18n.language, { month: "short" }),
      })
    }
    return out
  }, [i18n.language])

  // The clipped-off month just before the window (May), shown in the left
  // gutter so the edges read as "…mai ¦ jun … jul … ¦ aug".
  const leadLabel = FOCUS_START.subtract({ months: 1 }).toLocaleString(
    i18n.language,
    { month: "short" },
  )

  // Weekend bands (Sat–Sun) shaded as subtle vertical fills, for context.
  // Start from the Saturday on or before the window so a weekend
  // straddling the left edge still shows its in-window Sunday; fraction() clamps
  // the band to the visible window.
  const weekends = useMemo(() => {
    const out: { date: Temporal.PlainDate }[] = []
    const back = (FOCUS_START.dayOfWeek - 6 + 7) % 7 // days back to Saturday
    let sat = FOCUS_START.subtract({ days: back })
    while (Temporal.PlainDate.compare(sat, FOCUS_END) < 0) {
      out.push({ date: sat })
      sat = sat.add({ days: 7 })
    }
    return out
  }, [])

  // Dotted dividers on each ISO week boundary (Monday) inside the window, each
  // labelled with its week number on its leading (left) edge.
  const weeks = useMemo(() => {
    const out: { date: Temporal.PlainDate; week: number }[] = []
    // First Monday on or after the window start.
    const offset = (8 - FOCUS_START.dayOfWeek) % 7
    let cur = FOCUS_START.add({ days: offset })
    while (Temporal.PlainDate.compare(cur, FOCUS_END) < 0) {
      out.push({ date: cur, week: cur.weekOfYear ?? 0 })
      cur = cur.add({ days: 7 })
    }
    return out
  }, [])

  return (
    <Card asChild>
      <section aria-label={t("Season overview")}>
        <Card.Block>
          <div className={styles.chart}>
            {/* Adjacent month before the window, parked in the left gutter. */}
            <span className={styles.leadLabel}>{leadLabel}</span>

            {/* Weekend (Sat–Sun) fills, drawn first so everything else layers
                on top. */}
            {weekends.map(w => {
              const left = fraction(w.date)
              const right = fraction(w.date.add({ days: 2 }))
              return (
                <div
                  key={w.date.toString()}
                  className={styles.weekend}
                  style={{
                    left: `${String(left * 100)}%`,
                    width: `${String(Math.max(right - left, 0) * 100)}%`,
                  }}
                />
              )
            })}

            {/* Dotted week dividers, drawn under the solid month lines, each
                labelled with its ISO week number on its leading edge. */}
            {weeks.map(w => (
              <div
                key={w.date.toString()}
                className={styles.week}
                style={{ left: pct(w.date) }}
              >
                <span className={styles.weekLabel}>{w.week}</span>
              </div>
            ))}

            {/* Month markers span the full chart height: a solid divider with
                the month name sitting to its right. */}
            {boundaries.map(m => {
              // The trailing boundary (Aug 1) is just out-of-range context.
              const outOfRange =
                Temporal.PlainDate.compare(m.date, FOCUS_END) >= 0
              return (
                <div
                  key={m.label}
                  className={styles.month}
                  style={{ left: pct(m.date) }}
                >
                  <span
                    className={
                      outOfRange
                        ? `${styles.monthLabel} ${styles.monthLabelFaint}`
                        : styles.monthLabel
                    }
                  >
                    {m.label}
                  </span>
                </div>
              )
            })}

            <div className={styles.lanes}>
              {lanes.length === 0 && (
                <Paragraph className={styles.empty}>
                  {t("No stays booked this season.")}
                </Paragraph>
              )}
              {lanes.map(lane => (
                <div key={lane.userId} className={styles.lane}>
                  {lane.bars.map((bar, i) => {
                    const left = fraction(bar.start)
                    const right = fraction(bar.end.add({ days: 1 }))
                    const color =
                      lane.groupId > 0
                        ? groupColor(lane.groupId)
                        : NO_GROUP_COLOR
                    const key = `${String(bar.bookingId)}-${String(i)}`
                    return (
                      <Fragment key={key}>
                        <span
                          className={bar.queued ? styles.barQueued : styles.bar}
                          style={{
                            left: `${String(left * 100)}%`,
                            width: `${String(Math.max(right - left, 0) * 100)}%`,
                            // backgroundColor (not the `background` shorthand) so
                            // the queued bar's hatch background-image survives.
                            backgroundColor: color,
                          }}
                        />
                        {/* Label is a SIBLING of the bar, not a child: a child
                            inside the bar would be hard to keep readable over the
                            queued hatch. Positioned at the bar's start. */}
                        <span
                          className={styles.laneLabel}
                          style={{ left: `${String(left * 100)}%` }}
                          aria-hidden="true"
                        >
                          {lane.name}
                        </span>
                      </Fragment>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {legend.length > 0 && (
            <ul className={styles.legend}>
              {legend.map(item => (
                <li key={item.key} className={styles.legendItem}>
                  <span
                    className={styles.legendSwatch}
                    style={{ background: item.color }}
                  />
                  {item.label}
                </li>
              ))}
              {/* Weekend key, parked at the opposite (right) end of the row. */}
              <li className={styles.legendWeekend}>
                <span className={styles.legendWeekendSwatch} />
                {t("Weekend")}
              </li>
            </ul>
          )}
        </Card.Block>
      </section>
    </Card>
  )
}
