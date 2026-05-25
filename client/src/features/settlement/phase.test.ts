import { describe, expect, test } from "vitest"
import { NEXT_PHASE, PREV_PHASE, phaseAtLeast } from "./phase.ts"

describe("phaseAtLeast", () => {
  test("true when current equals target", () => {
    expect(phaseAtLeast("reviewing", "reviewing")).toBe(true)
  })

  test("true when current is past target", () => {
    expect(phaseAtLeast("closed", "reviewing")).toBe(true)
  })

  test("false when current is before target", () => {
    expect(phaseAtLeast("collecting_expenses", "reviewing")).toBe(false)
  })
})

describe("NEXT_PHASE / PREV_PHASE", () => {
  test("NEXT_PHASE forms a chain ending in null", () => {
    expect(NEXT_PHASE.collecting_expenses).toBe("collecting_bookings")
    expect(NEXT_PHASE.collecting_bookings).toBe("reviewing")
    expect(NEXT_PHASE.reviewing).toBe("split_policy")
    expect(NEXT_PHASE.split_policy).toBeNull()
    expect(NEXT_PHASE.closed).toBeNull()
  })

  test("PREV_PHASE is the inverse of NEXT_PHASE for the linear chain", () => {
    expect(PREV_PHASE.collecting_bookings).toBe("collecting_expenses")
    expect(PREV_PHASE.reviewing).toBe("collecting_bookings")
    expect(PREV_PHASE.split_policy).toBe("reviewing")
    expect(PREV_PHASE.collecting_expenses).toBeNull()
  })
})
