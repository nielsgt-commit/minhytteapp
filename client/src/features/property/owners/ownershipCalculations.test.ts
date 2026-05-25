import { describe, expect, test } from "vitest"
import {
  ownerLabel,
  ownershipOffBy,
  totalOwnershipPct,
} from "./ownershipCalculations.ts"

const userOwner = {
  user_id: 7,
  user_group_id: null,
  user_name: "Alice",
  user_group_name: null,
  ownership_pct: 60,
}

const groupOwner = {
  user_id: null,
  user_group_id: 2,
  user_name: null,
  user_group_name: "Family",
  ownership_pct: "40",
}

describe("ownerLabel", () => {
  test("uses user_name for user owners", () => {
    expect(ownerLabel(userOwner)).toBe("Alice")
  })

  test("uses user_group_name for group owners", () => {
    expect(ownerLabel(groupOwner)).toBe("Family")
  })

  test("falls back to '#id' label when name is missing", () => {
    expect(ownerLabel({ ...userOwner, user_name: null })).toBe("user #7")
    expect(ownerLabel({ ...groupOwner, user_group_name: null })).toBe(
      "group #2",
    )
  })
})

describe("totalOwnershipPct", () => {
  test("sums numeric and stringified percentages", () => {
    expect(totalOwnershipPct([userOwner, groupOwner])).toBe(100)
  })

  test("returns 0 for empty list", () => {
    expect(totalOwnershipPct([])).toBe(0)
  })
})

describe("ownershipOffBy", () => {
  test("returns 0 when owners total exactly 100", () => {
    expect(ownershipOffBy([userOwner, groupOwner])).toBe(0)
  })

  test("returns the absolute distance from 100", () => {
    expect(ownershipOffBy([{ ...userOwner, ownership_pct: 30 }])).toBe(70)
    expect(ownershipOffBy([{ ...userOwner, ownership_pct: 130 }])).toBe(30)
  })
})
