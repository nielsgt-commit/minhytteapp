import { describe, expect, test } from "vitest"
import {
  bedCapacity,
  expandRange,
  fromIso,
  groupConsecutive,
  propertyCapacity,
  toIso,
} from "./helpers.ts"

describe("toIso / fromIso round-trip", () => {
  test("round-trips a local date", () => {
    expect(toIso(fromIso("2026-07-15"))).toBe("2026-07-15")
  })
})

describe("expandRange", () => {
  test("single-day range returns that day", () => {
    expect(expandRange("2026-01-01", "2026-01-01")).toEqual(["2026-01-01"])
  })

  test("inclusive on both ends", () => {
    expect(expandRange("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ])
  })

  test("returns empty when end is before start", () => {
    expect(expandRange("2026-01-05", "2026-01-01")).toEqual([])
  })
})

describe("groupConsecutive", () => {
  test("returns empty array for empty input", () => {
    expect(groupConsecutive([])).toEqual([])
  })

  test("collapses contiguous dates into a single range", () => {
    const result = groupConsecutive(["2026-01-01", "2026-01-02", "2026-01-03"])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ start: "2026-01-01", end: "2026-01-03" })
  })

  test("splits non-contiguous dates into multiple ranges", () => {
    const result = groupConsecutive([
      "2026-01-01",
      "2026-01-02",
      "2026-01-05",
      "2026-01-06",
    ])
    expect(result).toHaveLength(2)
    expect(result[0]?.end).toBe("2026-01-02")
    expect(result[1]?.start).toBe("2026-01-05")
  })

  test("dedupes and sorts input", () => {
    const result = groupConsecutive([
      "2026-01-03",
      "2026-01-01",
      "2026-01-02",
      "2026-01-02",
    ])
    expect(result).toEqual([
      {
        start: "2026-01-01",
        end: "2026-01-03",
        days: ["2026-01-01", "2026-01-02", "2026-01-03"],
      },
    ])
  })
})

describe("bedCapacity", () => {
  test("counts each bed type, doubles count for 2", () => {
    expect(
      bedCapacity({
        beds_sm: 1,
        beds_lg: 1,
        beds_double: 2, // → 4
        beds_kid: 1,
        mattresses: 1,
        travel_cot: 1,
      }),
    ).toBe(9)
  })

  test("returns 0 for an empty room", () => {
    expect(
      bedCapacity({
        beds_sm: 0,
        beds_lg: 0,
        beds_double: 0,
        beds_kid: 0,
        mattresses: 0,
        travel_cot: 0,
      }),
    ).toBe(0)
  })
})

describe("propertyCapacity", () => {
  const emptyBeds = {
    beds_sm: 0,
    beds_lg: 0,
    beds_double: 0,
    beds_kid: 0,
    mattresses: 0,
    travel_cot: 0,
  }

  test("sums beds only from rooms inside habitable structures", () => {
    const rooms = [
      { ...emptyBeds, structure_id: 1, beds_sm: 2 }, // cabin → counted
      { ...emptyBeds, structure_id: 2, beds_lg: 3 }, // shed → ignored
    ]
    const structures = [
      { id: 1, category: "habitable" },
      { id: 2, category: "storage" },
    ]
    expect(propertyCapacity(rooms, structures)).toBe(2)
  })

  test("returns 0 when no habitable structures exist", () => {
    const rooms = [{ ...emptyBeds, structure_id: 1, beds_lg: 5 }]
    const structures = [{ id: 1, category: "storage" }]
    expect(propertyCapacity(rooms, structures)).toBe(0)
  })
})
