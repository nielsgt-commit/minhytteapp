import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import {
  Button,
  Card,
  Paragraph,
  Popover,
  Tag,
  ToggleGroup,
} from "@digdir/designsystemet-react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExpandIcon,
  ShrinkIcon,
} from "@navikt/aksel-icons"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { useTRPC } from "@/trpc/trpc.ts"
import { formatDateRange } from "@/utils/dateUtils"
import { groupColor } from "@/features/usergroups/groupColors"
import {
  FALLBACK_SEASON,
  peakWindow,
  seasonInstanceYear,
  seasonWindow,
  type DateWindow,
  type Season,
} from "@/features/seasons/seasonUtils"
import { YEAR } from "../constants.ts"
import styles from "./StaySummaryCompact.module.css"

// No family group → a neutral bar, matching the calendar dots.
const NO_GROUP_COLOR = "var(--ds-color-neutral-base-default)"

// Two focus windows the panel can zoom to, per season:
//  - "season": the whole season window. Stays bleeding out of it are clipped
//    at the edges; the adjacent month names are still shown in the side
//    gutters for context.
//  - "peak": just the season's priority weeks, so the lanes and bars are big
//    enough to read on a phone. Clipping and gutter labels work the same,
//    now relative to the tighter window.
type FocusMode = "season" | "peak"

// One selectable entry in the season toggle: a season (configured, or the
// built-in fallback) resolved to concrete windows for its current-or-next
// occurrence.
type SeasonModel = {
  key: string
  season: Season
  window: DateWindow
  peak: DateWindow | null
}

// Longest peak window that still gets the per-day letter grid; beyond this
// the letters would collide.
const DAY_GRID_MAX_DAYS = 35

type Bar = {
  bookingId: number
  start: Temporal.PlainDate
  end: Temporal.PlainDate
  queued: boolean
  // Booking details for the click-to-open popover. Carried on the bar so the
  // popover needs no second lookup back into the raw booking list.
  bookerName: string
  status: "pending" | "confirmed" | "cancelled"
  notes: string | null
  occupants: {
    name: string
    queued: boolean
    // Where this person sleeps: a room id, or a tent (sleeps separately), or
    // nothing assigned yet. Resolved to a label at render time so it tracks
    // the active language.
    roomId: number | null
    sleepsSeparately: boolean
  }[]
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

  const { data: seasons } = useSuspenseQuery(
    trpc.season.list.queryOptions({ property_id: propertyId }),
  )

  // Fixed per mount so the memos below don't churn; a chart doesn't need to
  // notice midnight.
  const [today] = useState(() => Temporal.Now.plainDateISO())

  // Configured seasons resolved to concrete windows; without any, the
  // built-in fallback reproduces the original hardcoded summer view (Jun 1 –
  // Aug 1, peak weeks 28–30, pinned to the YEAR roll-over heuristic).
  const models = useMemo<SeasonModel[]>(() => {
    if (seasons.length === 0) {
      const window = seasonWindow(FALLBACK_SEASON, YEAR)
      return [
        {
          key: "fallback",
          season: FALLBACK_SEASON,
          window,
          peak: peakWindow(FALLBACK_SEASON, YEAR),
        },
      ]
    }
    return seasons.map(s => {
      const year = seasonInstanceYear(s, today)
      return {
        key: String(s.id),
        season: s,
        window: seasonWindow(s, year),
        peak: peakWindow(s, year),
      }
    })
  }, [seasons, today])

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // Default season: the one we're in right now, else the next to start.
  // (Every model's window ends after today by construction.)
  const active =
    models.find(m => m.key === selectedKey) ??
    models.find(m => Temporal.PlainDate.compare(m.window.start, today) <= 0) ??
    models.reduce((a, b) =>
      Temporal.PlainDate.compare(a.window.start, b.window.start) <= 0 ? a : b,
    )

  // Step through the seasons in chronological order, wrapping at the ends
  // (after Vinter comes Vår again).
  const stepSeason = (delta: number) => {
    const index = models.indexOf(active)
    const next = models[(index + delta + models.length) % models.length]
    setSelectedKey(next.key)
  }

  // Fullscreen-landscape mode: the whole card goes fullscreen via the
  // Fullscreen API, with a best-effort orientation lock to landscape
  // (honored on Android phones; a lock failure elsewhere is ignored).
  // iPhone Safari has no element Fullscreen API at all, so there the button
  // falls back to "pseudo" fullscreen: the card is pinned over the viewport
  // with position:fixed. Orientation can't be locked either — rotating the
  // phone is up to the user.
  const sectionRef = useRef<HTMLElement>(null)
  const canNativeFullscreen = document.fullscreenEnabled
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === sectionRef.current)
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
    }
  }, [])

  // While pseudo-fullscreen the card covers the page, but the page itself
  // must not scroll underneath it.
  useEffect(() => {
    if (!isPseudoFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isPseudoFullscreen])

  const fullscreenActive = isFullscreen || isPseudoFullscreen

  const toggleFullscreen = () => {
    if (!canNativeFullscreen) {
      setIsPseudoFullscreen(v => !v)
      return
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    const el = sectionRef.current
    if (!el) return
    void el
      .requestFullscreen()
      .then(() => {
        // TS 5.1+ dropped ScreenOrientation.lock from lib.dom (Safari never
        // shipped it), so reach for it through an optional-member cast.
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>
        }
        return orientation.lock?.("landscape")
      })
      // The lock (or fullscreen itself) failing just leaves the current
      // orientation — nothing to surface.
      .catch(() => undefined)
  }

  const [mode, setMode] = useState<FocusMode>("peak")
  // A season without priority weeks has no peak window to zoom to.
  const effectiveMode: FocusMode = active.peak ? mode : "season"
  const focus =
    effectiveMode === "peak" && active.peak ? active.peak : active.window
  const focusStart = focus.start
  const focusEnd = focus.end
  const spanDays = focusStart.until(focusEnd).days

  // Fraction 0..1 of where a date sits across the active focus window, and its
  // percentage form for inline positioning. Closures so they track the toggle.
  const fraction = (date: Temporal.PlainDate): number => {
    const d = focusStart.until(date).days / spanDays
    return Math.max(0, Math.min(1, d))
  }
  const pct = (date: Temporal.PlainDate): string =>
    `${String(fraction(date) * 100)}%`

  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: userGroups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )

  // room id → "Building · Room" label, for the popover's "Where" list.
  const roomLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rooms) map.set(r.id, `${r.structure_name} · ${r.name}`)
    return map
  }, [rooms])

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
    // Children aren't family-group members themselves — they inherit their
    // parent's group.
    const groupForOccupant = (o: {
      user_id: number
      parent_user_id: number | null
    }): number =>
      familyGroupByUser.get(o.user_id) ??
      (o.parent_user_id != null
        ? (familyGroupByUser.get(o.parent_user_id) ?? 0)
        : 0)

    const byUser = new Map<number, Lane>()
    for (const b of bookings) {
      if (b.status === "cancelled") continue
      // Skip bookings entirely outside the active focus window.
      if (
        Temporal.PlainDate.compare(b.end_date, focusStart) < 0 ||
        Temporal.PlainDate.compare(b.start_date, focusEnd) >= 0
      )
        continue
      for (const o of b.occupants) {
        let lane = byUser.get(o.user_id)
        if (!lane) {
          lane = {
            userId: o.user_id,
            name: o.user_name ?? `#${String(o.user_id)}`,
            groupId: groupForOccupant(o),
            bars: [],
          }
          byUser.set(o.user_id, lane)
        }
        lane.bars.push({
          bookingId: b.id,
          start: b.start_date,
          end: b.end_date,
          queued: o.queued,
          bookerName: b.booker_name ?? `#${String(b.booker_id)}`,
          status: b.status,
          notes: b.notes,
          occupants: b.occupants.map(x => ({
            name: x.user_name ?? `#${String(x.user_id)}`,
            queued: x.queued,
            roomId: x.room_id,
            sleepsSeparately: x.sleeps_separately,
          })),
        })
      }
    }
    // Group families together, then alphabetical within a group.
    return [...byUser.values()].sort(
      (a, b) => a.groupId - b.groupId || a.name.localeCompare(b.name),
    )
  }, [bookings, familyGroupByUser, focusStart, focusEnd])

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

  // Dotted dividers sit on each month boundary the window touches (e.g. in the
  // season view: Jun 1 at the left edge, Jul 1 in the middle, Aug 1 at the right
  // edge); each carries the name of the month that begins there, to its right.
  // A PlainDate cursor rather than a month-number loop, so windows crossing
  // New Year (a Dec–Feb season) keep working.
  const boundaries = useMemo(() => {
    const out: { date: Temporal.PlainDate; label: string }[] = []
    let cur = focusStart.with({ day: 1 })
    while (Temporal.PlainDate.compare(cur, focusEnd) <= 0) {
      out.push({
        date: cur,
        label: cur.toLocaleString(i18n.language, { month: "short" }),
      })
      cur = cur.add({ months: 1 })
    }
    return out
  }, [i18n.language, focusStart, focusEnd])

  // The clipped-off month just before the window (May in the season view), shown
  // in the left gutter so the edges read as "…mai ¦ jun … jul … ¦ aug".
  const leadLabel = focusStart
    .subtract({ months: 1 })
    .toLocaleString(i18n.language, { month: "short" })

  // Weekend bands (Sat–Sun) shaded as subtle vertical fills, for context.
  // Start from the Saturday on or before the window so a weekend
  // straddling the left edge still shows its in-window Sunday; fraction() clamps
  // the band to the visible window.
  const weekends = useMemo(() => {
    const out: { date: Temporal.PlainDate }[] = []
    const back = (focusStart.dayOfWeek - 6 + 7) % 7 // days back to Saturday
    let sat = focusStart.subtract({ days: back })
    while (Temporal.PlainDate.compare(sat, focusEnd) < 0) {
      out.push({ date: sat })
      sat = sat.add({ days: 7 })
    }
    return out
  }, [focusStart, focusEnd])

  // Dotted dividers on each ISO week boundary (Monday) inside the window, each
  // labelled with its week number on its leading (left) edge.
  const weeks = useMemo(() => {
    const out: { date: Temporal.PlainDate; week: number }[] = []
    // First Monday on or after the window start.
    const offset = (8 - focusStart.dayOfWeek) % 7
    let cur = focusStart.add({ days: offset })
    while (Temporal.PlainDate.compare(cur, focusEnd) < 0) {
      out.push({ date: cur, week: cur.weekOfYear ?? 0 })
      cur = cur.add({ days: 7 })
    }
    return out
  }, [focusStart, focusEnd])

  // In the zoomed peak view, a day grid: a faint gridline on each weekday
  // boundary plus that day's first letter centred over its column. Skipped in
  // the season view (far too dense at ~60 days) and for long peak windows
  // where the letters would collide. The narrow weekday name is localized
  // (e.g. "M T O T F L S" in Norwegian).
  const days = useMemo(() => {
    if (effectiveMode !== "peak" || spanDays > DAY_GRID_MAX_DAYS) return []
    const out: { date: Temporal.PlainDate; letter: string }[] = []
    let cur = focusStart
    while (Temporal.PlainDate.compare(cur, focusEnd) < 0) {
      out.push({
        date: cur,
        letter: cur.toLocaleString(i18n.language, { weekday: "narrow" }),
      })
      cur = cur.add({ days: 1 })
    }
    return out
  }, [effectiveMode, spanDays, focusStart, focusEnd, i18n.language])

  return (
    <Card asChild>
      <section
        ref={sectionRef}
        className={
          isPseudoFullscreen
            ? `${styles.host} ${styles.hostPseudoFullscreen}`
            : styles.host
        }
        aria-label={t("Season overview")}
      >
        <Card.Block>
          {/* Toolbar: season chevrons top-left (hidden with a single season)
              step through the configured seasons; the zoom toggle top-right
              switches between the whole season and just its priority weeks. */}
          <div className={styles.toolbar}>
            {models.length >= 2 && (
              <div className={styles.seasonNav}>
                <Button
                  type="button"
                  variant="tertiary"
                  icon
                  data-size="sm"
                  aria-label={t("Previous season")}
                  onClick={() => {
                    stepSeason(-1)
                  }}
                >
                  <ChevronLeftIcon aria-hidden />
                </Button>
                <Paragraph asChild data-size="sm">
                  <output className={styles.seasonName}>
                    {active.season.name}
                  </output>
                </Paragraph>
                <Button
                  type="button"
                  variant="tertiary"
                  icon
                  data-size="sm"
                  aria-label={t("Next season")}
                  onClick={() => {
                    stepSeason(1)
                  }}
                >
                  <ChevronRightIcon aria-hidden />
                </Button>
              </div>
            )}
            <ToggleGroup
              value={effectiveMode}
              onChange={value => {
                setMode(value as FocusMode)
              }}
              data-size="sm"
              data-toggle-group={t("Focus")}
              className={styles.focusToggle}
            >
              <ToggleGroup.Item value="season">{t("Season")}</ToggleGroup.Item>
              {active.peak && (
                <ToggleGroup.Item value="peak">
                  {t("Peak weeks")}
                </ToggleGroup.Item>
              )}
            </ToggleGroup>
            <Button
              type="button"
              variant="tertiary"
              icon
              data-size="sm"
              className={styles.fullscreenButton}
              aria-label={
                fullscreenActive
                  ? t("Exit fullscreen")
                  : t("Fullscreen landscape")
              }
              onClick={toggleFullscreen}
            >
              {fullscreenActive ? (
                <ShrinkIcon aria-hidden />
              ) : (
                <ExpandIcon aria-hidden />
              )}
            </Button>
          </div>
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

            {/* Per-day grid (peak view only): a faint gridline on each day's
                start edge, drawn under the week/month dividers, plus the day's
                first letter centred over its column. The window-start edge and
                Mondays get no line — the labelled week divider already sits
                there. */}
            {days.map(d => {
              const start = fraction(d.date)
              const end = fraction(d.date.add({ days: 1 }))
              const isMonday = d.date.dayOfWeek === 1
              return (
                <Fragment key={d.date.toString()}>
                  {start > 0 && !isMonday && (
                    <span
                      className={styles.day}
                      style={{ left: `${String(start * 100)}%` }}
                    />
                  )}
                  <span
                    className={styles.dayLetter}
                    style={{ left: `${String(((start + end) / 2) * 100)}%` }}
                  >
                    {d.letter}
                  </span>
                </Fragment>
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
                Temporal.PlainDate.compare(m.date, focusEnd) >= 0
              return (
                <div
                  key={m.date.toString()}
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

            <div
              className={[
                styles.lanes,
                effectiveMode === "peak" && styles.lanesPeak,
                fullscreenActive && styles.lanesFullscreen,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {lanes.length === 0 && (
                <Paragraph className={styles.empty}>
                  {t("No stays booked this season.")}
                </Paragraph>
              )}
              {lanes.map(lane => (
                <div key={lane.userId} className={styles.lane}>
                  {/* Fullscreen shows the name always, level with the lane's
                      bars; outside fullscreen the name only appears on hover
                      (the per-bar label below). */}
                  {fullscreenActive && (
                    <span className={styles.laneName}>{lane.name}</span>
                  )}
                  {lane.bars.map((bar, i) => {
                    const left = fraction(bar.start)
                    const right = fraction(bar.end.add({ days: 1 }))
                    const color =
                      lane.groupId > 0
                        ? groupColor(lane.groupId)
                        : NO_GROUP_COLOR
                    const key = `${String(bar.bookingId)}-${String(i)}`
                    const nights = bar.start.until(bar.end, {
                      largestUnit: "days",
                    }).days
                    // Group this booking's occupants by where they sleep.
                    const whereByKey = new Map<
                      string,
                      { label: string; names: string[] }
                    >()
                    for (const o of bar.occupants) {
                      let groupKey: string
                      let label: string
                      if (o.sleepsSeparately) {
                        groupKey = "tent"
                        label = t("Tent")
                      } else if (o.roomId != null) {
                        groupKey = `room-${String(o.roomId)}`
                        label = roomLabelById.get(o.roomId) ?? t("Unassigned")
                      } else {
                        groupKey = "unassigned"
                        label = t("Unassigned")
                      }
                      const entry = whereByKey.get(groupKey) ?? {
                        label,
                        names: [],
                      }
                      entry.names.push(o.name)
                      whereByKey.set(groupKey, entry)
                    }
                    const whereGroups = [...whereByKey.entries()]
                    return (
                      <Popover.TriggerContext key={key}>
                        {/* The thin bar is the trigger; Popover.Trigger injects
                            the button role, focus and keyboard handling. */}
                        <Popover.Trigger asChild>
                          <span
                            className={
                              bar.queued ? styles.barQueued : styles.bar
                            }
                            style={{
                              left: `${String(left * 100)}%`,
                              width: `${String(Math.max(right - left, 0) * 100)}%`,
                              // backgroundColor (not the `background` shorthand)
                              // so the queued bar's hatch background-image
                              // survives.
                              backgroundColor: color,
                            }}
                          />
                        </Popover.Trigger>
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
                        <Popover
                          placement="top"
                          data-color="neutral"
                          className={styles.barPopover}
                        >
                          <p className={styles.popName}>{bar.bookerName}</p>
                          <Tag
                            data-size="sm"
                            data-color={
                              bar.status === "confirmed" ? "success" : "warning"
                            }
                          >
                            {bar.status === "confirmed"
                              ? t("Confirmed")
                              : t("Pending")}
                          </Tag>
                          <dl className={styles.popList}>
                            <dt>{t("Dates")}</dt>
                            <dd>
                              {formatDateRange(
                                bar.start,
                                bar.end,
                                i18n.language,
                              )}
                              {" · "}
                              {t("{{count}} night", { count: nights })}
                            </dd>
                            <dt>{t("Guests")}</dt>
                            <dd>
                              {bar.occupants
                                .map(o =>
                                  o.queued
                                    ? `${o.name}${t(" (queued)")}`
                                    : o.name,
                                )
                                .join(", ")}
                            </dd>
                            <dt>{t("Where")}</dt>
                            <dd>
                              {whereGroups.map(([groupKey, g]) => (
                                <div key={groupKey}>
                                  {g.label}: {g.names.join(", ")}
                                </div>
                              ))}
                            </dd>
                            {bar.notes && (
                              <>
                                <dt>{t("Notes")}</dt>
                                <dd>{bar.notes}</dd>
                              </>
                            )}
                          </dl>
                        </Popover>
                      </Popover.TriggerContext>
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
