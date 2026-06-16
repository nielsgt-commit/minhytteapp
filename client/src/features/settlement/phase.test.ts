import { describe, expect, test } from "vitest"
import {
  SETTLEMENT_PHASES,
  nextPhaseIn,
  phaseAtLeast,
  prevPhaseIn,
  requiredPhases,
} from "./phase.ts"
import { SPLIT_POLICY_PARAMETERS } from "@server/shared/splitPolicy.ts"

const ALL = [...SPLIT_POLICY_PARAMETERS]
const NO_BOOKINGS = ALL.filter(p => p !== "booking_days")

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

describe("requiredPhases", () => {
  test("includes every phase when booking_days is enabled", () => {
    expect(requiredPhases(ALL)).toEqual([...SETTLEMENT_PHASES])
  })

  test("drops collecting_bookings when booking_days is off", () => {
    expect(requiredPhases(NO_BOOKINGS)).toEqual([
      "collecting_expenses",
      "reviewing",
      "split_policy",
      "closed",
    ])
  })
})

describe("nextPhaseIn / prevPhaseIn", () => {
  test("forms the legacy chain with all parameters", () => {
    const phases = requiredPhases(ALL)
    expect(nextPhaseIn(phases, "collecting_expenses")).toBe(
      "collecting_bookings",
    )
    expect(nextPhaseIn(phases, "collecting_bookings")).toBe("reviewing")
    expect(nextPhaseIn(phases, "reviewing")).toBe("split_policy")
    expect(nextPhaseIn(phases, "split_policy")).toBeNull()
    expect(nextPhaseIn(phases, "closed")).toBeNull()
    expect(prevPhaseIn(phases, "collecting_bookings")).toBe(
      "collecting_expenses",
    )
    expect(prevPhaseIn(phases, "reviewing")).toBe("collecting_bookings")
    expect(prevPhaseIn(phases, "split_policy")).toBe("reviewing")
    expect(prevPhaseIn(phases, "collecting_expenses")).toBeNull()
    expect(prevPhaseIn(phases, "closed")).toBeNull()
  })

  test("skips the booking phase in both directions when not required", () => {
    const phases = requiredPhases(NO_BOOKINGS)
    expect(nextPhaseIn(phases, "collecting_expenses")).toBe("reviewing")
    expect(prevPhaseIn(phases, "reviewing")).toBe("collecting_expenses")
  })

  test("recovers a settlement stranded in a no-longer-required phase", () => {
    const phases = requiredPhases(NO_BOOKINGS)
    expect(nextPhaseIn(phases, "collecting_bookings")).toBe("reviewing")
    expect(prevPhaseIn(phases, "collecting_bookings")).toBe(
      "collecting_expenses",
    )
  })
})
