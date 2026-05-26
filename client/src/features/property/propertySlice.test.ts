import { describe, expect, test } from "vitest"
import {
  propertySlice,
  resetProperty,
  selectSelectedPropertyId,
  setSelectedPropertyId,
} from "./propertySlice.ts"

const initial = { selectedPropertyId: null }

describe("propertySlice initial state", () => {
  test("selectedPropertyId starts null", () => {
    expect(propertySlice.getInitialState()).toEqual(initial)
  })
})

describe("setSelectedPropertyId", () => {
  test("stores a numeric property id", () => {
    const next = propertySlice.reducer(initial, setSelectedPropertyId(42))
    expect(next.selectedPropertyId).toBe(42)
  })

  test("can clear the selection by passing null", () => {
    const next = propertySlice.reducer(
      { selectedPropertyId: 7 },
      setSelectedPropertyId(null),
    )
    expect(next.selectedPropertyId).toBeNull()
  })

  test("overwrites a previously stored id", () => {
    const next = propertySlice.reducer(
      { selectedPropertyId: 1 },
      setSelectedPropertyId(2),
    )
    expect(next.selectedPropertyId).toBe(2)
  })
})

describe("resetProperty", () => {
  test("returns state back to initial", () => {
    const next = propertySlice.reducer(
      { selectedPropertyId: 99 },
      resetProperty(),
    )
    expect(next).toEqual(initial)
  })
})

describe("selectSelectedPropertyId", () => {
  test("returns the id from slice-shaped state", () => {
    expect(selectSelectedPropertyId.unwrapped({ selectedPropertyId: 5 })).toBe(
      5,
    )
  })

  test("returns null when nothing is selected", () => {
    expect(selectSelectedPropertyId.unwrapped(initial)).toBeNull()
  })
})

describe("action creators", () => {
  test("setSelectedPropertyId carries payload", () => {
    expect(setSelectedPropertyId(3)).toEqual({
      type: "property/setSelectedPropertyId",
      payload: 3,
    })
  })

  test("resetProperty has no payload", () => {
    expect(resetProperty()).toEqual({
      type: "property/reset",
      payload: undefined,
    })
  })
})
