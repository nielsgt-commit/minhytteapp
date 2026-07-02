import { describe, expect, it } from "vitest"
import { Temporal } from "temporal-polyfill"
import {
  FALLBACK_SEASON,
  type Season,
  groupAssignmentsBySeason,
  isCrossYear,
  peakWindow,
  seasonInstanceYear,
  seasonWindow,
  weekRangeForSeason,
} from "./seasonUtils.ts"

const d = (iso: string) => Temporal.PlainDate.from(iso)

const summer: Season = {
  id: 1,
  name: "Summer",
  start_month: 6,
  start_day: 1,
  end_month: 7,
  end_day: 31,
  priority_weeks: [28, 29, 30],
}

const winter: Season = {
  id: 2,
  name: "Winter",
  start_month: 12,
  start_day: 1,
  end_month: 2,
  end_day: 28,
  priority_weeks: [51, 52, 1],
}

describe("seasonWindow", () => {
  it("resolves a same-year season with an exclusive end", () => {
    const w = seasonWindow(summer, 2026)
    expect(w.start.toString()).toBe("2026-06-01")
    expect(w.end.toString()).toBe("2026-08-01")
  })

  it("resolves a cross-year season into the next year", () => {
    expect(isCrossYear(winter)).toBe(true)
    const w = seasonWindow(winter, 2026)
    expect(w.start.toString()).toBe("2026-12-01")
    expect(w.end.toString()).toBe("2027-03-01")
  })

  it("constrains Feb 29 in common years", () => {
    const leapEnd: Season = { ...winter, end_day: 29 }
    // 2026→2027 winter: 2027 is a common year, Feb 29 → Feb 28.
    const w = seasonWindow(leapEnd, 2026)
    expect(w.end.toString()).toBe("2027-03-01")
  })

  it("fallback window matches the original hardcoded chart window", () => {
    const w = seasonWindow(FALLBACK_SEASON, 2026)
    expect(w.start.toString()).toBe("2026-06-01")
    expect(w.end.toString()).toBe("2026-08-01")
  })
})

describe("seasonInstanceYear", () => {
  it("picks the ongoing instance", () => {
    expect(seasonInstanceYear(summer, d("2026-07-15"))).toBe(2026)
  })

  it("picks the upcoming instance once the season has passed", () => {
    expect(seasonInstanceYear(summer, d("2026-09-01"))).toBe(2027)
  })

  it("keeps the running cross-year instance after New Year", () => {
    // In January 2027 the 2026→2027 winter is still ongoing.
    expect(seasonInstanceYear(winter, d("2027-01-15"))).toBe(2026)
  })

  it("picks the coming winter during the preceding summer", () => {
    expect(seasonInstanceYear(winter, d("2026-07-15"))).toBe(2026)
  })
})

describe("peakWindow", () => {
  it("spans the run of summer priority weeks", () => {
    // Weeks 28–30 of 2026: Mon 2026-07-06 .. Mon 2026-07-27 (exclusive).
    const w = peakWindow(summer, 2026)
    expect(w?.start.toString()).toBe("2026-07-06")
    expect(w?.end.toString()).toBe("2026-07-27")
  })

  it("resolves winter weeks after New Year into the next year", () => {
    const w = peakWindow(winter, 2026)
    // Week 51 of 2026 starts Mon 2026-12-14; week 1 of 2027 starts
    // Mon 2027-01-04 and ends (exclusive) 2027-01-11.
    expect(w?.start.toString()).toBe("2026-12-14")
    expect(w?.end.toString()).toBe("2027-01-11")
  })

  it("is null when a season has no priority weeks", () => {
    expect(peakWindow({ ...summer, priority_weeks: [] }, 2026)).toBeNull()
  })
})

describe("weekRangeForSeason", () => {
  it("matches the legacy peakWeekRange for the fallback path", () => {
    const r = weekRangeForSeason(null, 2026, 28)
    expect(r.start.toString()).toBe("2026-07-06")
    expect(r.end.toString()).toBe("2026-07-12")
  })

  it("moves a post-New-Year winter week into the following year", () => {
    const r = weekRangeForSeason(winter, 2026, 1)
    expect(r.start.toString()).toBe("2027-01-04")
    expect(r.end.toString()).toBe("2027-01-10")
  })
})

describe("groupAssignmentsBySeason", () => {
  const a = (
    user_group_id: number,
    iso_week: number,
    season_id: number | null,
  ) => ({
    user_group_id,
    iso_week,
    season_id,
  })

  it("buckets by explicit season id", () => {
    const { bySeason, unadopted } = groupAssignmentsBySeason(
      [summer, winter],
      [a(10, 28, 1), a(20, 51, 2)],
    )
    expect(bySeason.get(1)).toEqual([a(10, 28, 1)])
    expect(bySeason.get(2)).toEqual([a(20, 51, 2)])
    expect(unadopted).toEqual([])
  })

  it("adopts a legacy pick into the first season containing its week", () => {
    const { bySeason, unadopted } = groupAssignmentsBySeason(
      [summer, winter],
      [a(10, 29, null)],
    )
    expect(bySeason.get(1)).toEqual([a(10, 29, null)])
    expect(unadopted).toEqual([])
  })

  it("leaves a legacy pick matching no season as unadopted", () => {
    const { bySeason, unadopted } = groupAssignmentsBySeason(
      [summer, winter],
      [a(10, 35, null)],
    )
    expect(bySeason.get(1)).toEqual([])
    expect(unadopted).toEqual([a(10, 35, null)])
  })

  it("drops rows pointing at seasons not in the list (archived)", () => {
    const { bySeason, unadopted } = groupAssignmentsBySeason(
      [summer],
      [a(10, 51, 99)],
    )
    expect(bySeason.get(1)).toEqual([])
    expect(unadopted).toEqual([])
  })
})
