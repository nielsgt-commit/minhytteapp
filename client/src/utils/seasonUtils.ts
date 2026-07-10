import { Temporal } from "temporal-polyfill"
import { isCrossYear } from "@server/shared/season.ts"
import { isoWeekMonday } from "@/utils/dateUtils"

// A season as the client works with it: a recurring month+day range (end
// sorting before start = the range wraps the year boundary, e.g. Dec–Feb)
// plus the ISO weeks that count as priority weeks within it.
//
// `id: null` marks the built-in fallback used when a property has no seasons
// configured — it reproduces the original hardcoded behavior exactly.
export type Season = {
  id: number | null
  name: string
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  priority_weeks: number[]
}

// Jun 1 – Jul 31 inclusive: the chart's original Jun 1 – Aug 1 (exclusive)
// window, with the original peak weeks. The name is an i18n key (planstay ns).
export const FALLBACK_SEASON: Season = {
  id: null,
  name: "Summer",
  start_month: 6,
  start_day: 1,
  end_month: 7,
  end_day: 31,
  priority_weeks: [28, 29, 30],
}

// A concrete date window; `end` is EXCLUSIVE (one day past the last included
// day), which is what the chart math wants.
export type DateWindow = { start: Temporal.PlainDate; end: Temporal.PlainDate }

// Cross-year detection is shared with the server (season router validation);
// re-exported so client callers keep one import for all season helpers.
export { isCrossYear }

// The season's concrete window for the instance that STARTS in `startYear`;
// a cross-year season ends in `startYear + 1`. overflow: "constrain" resolves
// Feb 29 to Feb 28 in common years.
export function seasonWindow(s: Season, startYear: number): DateWindow {
  const start = Temporal.PlainDate.from(
    { year: startYear, month: s.start_month, day: s.start_day },
    { overflow: "constrain" },
  )
  const endInclusive = Temporal.PlainDate.from(
    {
      year: isCrossYear(s) ? startYear + 1 : startYear,
      month: s.end_month,
      day: s.end_day,
    },
    { overflow: "constrain" },
  )
  return { start, end: endInclusive.add({ days: 1 }) }
}

// Start year of the current-or-next instance: the smallest year whose window
// hasn't fully passed yet (ongoing counts; otherwise the upcoming one).
export function seasonInstanceYear(
  s: Season,
  today: Temporal.PlainDate,
): number {
  for (const year of [today.year - 1, today.year, today.year + 1]) {
    if (Temporal.PlainDate.compare(seasonWindow(s, year).end, today) > 0) {
      return year
    }
  }
  // Unreachable: the today.year + 1 window always ends after today.
  return today.year + 1
}

// Resolve a priority week of the `startYear` instance to its Monday. Weeks of
// a cross-year season that fall after New Year (e.g. week 1 of a Dec–Feb
// winter) belong to `startYear + 1`: if the whole ISO week of `startYear`
// ends before the season starts, it's the next year's week we mean.
function weekMonday(s: Season, startYear: number, week: number) {
  const monday = isoWeekMonday(startYear, week)
  const windowStart = seasonWindow(s, startYear).start
  if (Temporal.PlainDate.compare(monday.add({ days: 7 }), windowStart) <= 0) {
    return isoWeekMonday(startYear + 1, week)
  }
  return monday
}

// Window spanning all of the season's priority weeks (Monday of the first to
// the Monday after the last, end-exclusive), or null when none are configured.
export function peakWindow(s: Season, startYear: number): DateWindow | null {
  if (s.priority_weeks.length === 0) return null
  const mondays = s.priority_weeks.map(w => weekMonday(s, startYear, w))
  mondays.sort((a, b) => Temporal.PlainDate.compare(a, b))
  const first = mondays[0]
  const last = mondays[mondays.length - 1]
  return { start: first, end: last.add({ days: 7 }) }
}

// Mon–Sun range (INCLUSIVE end, matching priorityUtils' WeekRange) of one
// priority week, for date labels on the priority page. `season: null` = the
// fallback path, identical to the original peakWeekRange.
export function weekRangeForSeason(
  season: Season | null,
  startYear: number,
  week: number,
): { start: Temporal.PlainDate; end: Temporal.PlainDate } {
  const start = season
    ? weekMonday(season, startYear, week)
    : isoWeekMonday(startYear, week)
  return { start, end: start.add({ days: 6 }) }
}

export type SeasonAssignment = {
  user_group_id: number
  iso_week: number
  season_id: number | null
}

// Bucket priority assignments by configured season. A legacy pick
// (season_id null, made before the property configured seasons) is adopted by
// the FIRST season — in the given, chronological order — whose priority weeks
// contain its week; deterministic when two seasons share a week. Legacy picks
// matching no season land in `unadopted` (shown as a footnote, clearable).
// Rows pointing at a season that's not in `seasons` (i.e. archived) are
// dropped: they're history, not something the page can edit.
export function groupAssignmentsBySeason<A extends SeasonAssignment>(
  seasons: readonly Season[],
  assignments: readonly A[],
): { bySeason: Map<number, A[]>; unadopted: A[] } {
  const bySeason = new Map<number, A[]>()
  for (const s of seasons) {
    if (s.id != null) bySeason.set(s.id, [])
  }
  const unadopted: A[] = []
  for (const a of assignments) {
    if (a.season_id != null) {
      bySeason.get(a.season_id)?.push(a)
      continue
    }
    const adopter = seasons.find(s => s.priority_weeks.includes(a.iso_week))
    if (adopter?.id != null) {
      bySeason.get(adopter.id)?.push(a)
    } else {
      unadopted.push(a)
    }
  }
  return { bySeason, unadopted }
}
