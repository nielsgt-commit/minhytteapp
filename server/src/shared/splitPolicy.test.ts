import { describe, expect, it } from "vitest"
import {
  SETTLEMENT_PHASES,
  SPLIT_POLICY_PARAMETERS,
  type SplitPolicyConfig,
  type SplitPolicyParameter,
  allowedHowKinds,
  allowedWhenKinds,
  allowedWindowKinds,
  configViolations,
  nextPhaseIn,
  normalizeParameters,
  phaseAtLeast,
  normalizeWhat,
  prevPhaseIn,
  requiredPhases,
  sanitizeConfigForParameters,
} from "./splitPolicy.ts"

const baseFallback = {
  how: { kind: "equally" as const },
  who: [{ kind: "main_groups" as const }],
  except: [],
  when: { kind: "always" as const },
}

describe("normalizeParameters", () => {
  it("treats absent parameters as all enabled", () => {
    expect(normalizeParameters(undefined)).toEqual([...SPLIT_POLICY_PARAMETERS])
  })

  it("keeps an explicit selection", () => {
    expect(normalizeParameters(["ownership"])).toEqual(["ownership"])
  })

  it("maps the legacy priority_weeks parameter to time_conditions", () => {
    const legacy = [
      "booking_days",
      "priority_weeks",
    ] as unknown as SplitPolicyParameter[]
    expect(normalizeParameters(legacy)).toEqual([
      "booking_days",
      "time_conditions",
    ])
  })

  it("drops time_conditions when stay data is absent", () => {
    expect(normalizeParameters(["time_conditions"])).toEqual([])
  })
})

describe("capability mapping", () => {
  it("always allows equally and always", () => {
    expect(allowedHowKinds([]).has("equally")).toBe(true)
    expect(allowedWhenKinds([]).has("always")).toBe(true)
  })

  it("gates occupancy behind booking_days", () => {
    expect(allowedHowKinds([]).has("weighted_by_occupancy")).toBe(false)
    expect(allowedHowKinds(["booking_days"]).has("weighted_by_occupancy")).toBe(
      true,
    )
  })

  it("gates ownership behind its parameter", () => {
    expect(allowedHowKinds(["ownership"]).has("by_ownership_pct")).toBe(true)
  })

  it("gates every time condition behind time_conditions", () => {
    expect(allowedWhenKinds([]).has("present_when_expense_added")).toBe(false)
    expect(allowedWhenKinds(["time_conditions"]).has("present_this_year")).toBe(
      true,
    )
    expect(
      allowedWhenKinds(["time_conditions"]).has("present_when_expense_added"),
    ).toBe(true)
  })

  it("gates priority-week presence filters behind time_conditions", () => {
    expect(allowedWhenKinds([]).has("present_any_priority_week")).toBe(false)
    expect(allowedWhenKinds([]).has("present_priority_week")).toBe(false)
    const withTime = allowedWhenKinds(["time_conditions"])
    expect(withTime.has("present_any_priority_week")).toBe(true)
    expect(withTime.has("present_priority_week")).toBe(true)
  })

  it("gates priority-week person-day windows behind time_conditions", () => {
    expect(allowedWindowKinds([]).has("year")).toBe(true)
    expect(allowedWindowKinds([]).has("priority_week")).toBe(false)
    expect(
      allowedWindowKinds(["time_conditions"]).has("any_priority_week"),
    ).toBe(true)
    expect(allowedWindowKinds(["time_conditions"]).has("priority_week")).toBe(
      true,
    )
  })
})

describe("normalizeWhat", () => {
  it("passes through total", () => {
    expect(normalizeWhat({ kind: "total" })).toEqual({ kind: "total" })
  })

  it("migrates a legacy single category_id to category_ids", () => {
    expect(normalizeWhat({ kind: "category", category_id: 7 })).toEqual({
      kind: "category",
      category_ids: [7],
    })
  })

  it("keeps multi-category ids and de-dupes them", () => {
    expect(
      normalizeWhat({ kind: "category", category_ids: [7, 9, 7] }),
    ).toEqual({ kind: "category", category_ids: [7, 9] })
  })

  it("collapses an empty or malformed selection to total", () => {
    expect(normalizeWhat({ kind: "category", category_ids: [] })).toEqual({
      kind: "total",
    })
    expect(normalizeWhat(null)).toEqual({ kind: "total" })
    expect(normalizeWhat({ kind: "category" })).toEqual({ kind: "total" })
  })
})

describe("configViolations", () => {
  it("accepts a legacy config without parameters", () => {
    const config: SplitPolicyConfig = {
      rules: [
        {
          what: { kind: "category", category_ids: [1] },
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "all_users" }],
          except: [{ kind: "kids" }],
          when: { kind: "present_this_year" },
        },
      ],
      fallback: baseFallback,
    }
    expect(configViolations(config)).toEqual([])
  })

  it("flags every capability the parameter set forbids", () => {
    const config: SplitPolicyConfig = {
      parameters: [],
      rules: [
        {
          what: { kind: "category", category_ids: [1] },
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "heads_only" }],
          except: [{ kind: "kids" }],
          when: { kind: "present_this_year" },
        },
      ],
      fallback: { ...baseFallback, how: { kind: "by_ownership_pct" } },
    }
    const violations = configViolations(config)
    const parameters = violations.map(v => v.parameter)
    expect(parameters).toContain("expense_categories")
    expect(parameters).toContain("booking_days")
    expect(parameters).toContain("time_conditions")
    expect(parameters).toContain("participants")
    expect(parameters).toContain("ownership")
    expect(violations.find(v => v.target === "fallback")?.field).toBe("how")
  })

  it("accepts the forced participant default when participants is off", () => {
    const config: SplitPolicyConfig = {
      parameters: ["ownership"],
      rules: [],
      fallback: { ...baseFallback, how: { kind: "by_ownership_pct" } },
    }
    expect(configViolations(config)).toEqual([])
  })
})

describe("sanitizeConfigForParameters", () => {
  it("strips rules and downgrades the fallback to allowed kinds", () => {
    const config: SplitPolicyConfig = {
      parameters: [],
      rules: [
        {
          what: { kind: "category", category_ids: [1] },
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "all_users" }],
          except: [],
          when: { kind: "always" },
        },
      ],
      fallback: {
        how: { kind: "weighted_by_occupancy" },
        who: [{ kind: "heads_only" }],
        except: [{ kind: "kids" }],
        when: { kind: "present_this_year" },
      },
    }
    const sanitized = sanitizeConfigForParameters(config)
    expect(sanitized.rules).toEqual([])
    expect(sanitized.fallback).toEqual(baseFallback)
    expect(configViolations(sanitized)).toEqual([])
  })

  it("keeps a config that already fits its parameters", () => {
    const config: SplitPolicyConfig = {
      parameters: ["booking_days"],
      rules: [],
      fallback: {
        ...baseFallback,
        how: { kind: "weighted_by_occupancy" },
      },
      occupancy: {
        window: { kind: "year" },
        include_extra_guests: true,
        child_weight: 1,
      },
    }
    expect(sanitizeConfigForParameters(config)).toEqual(config)
  })
})

describe("phase gating", () => {
  const all = normalizeParameters(undefined)
  const noBookings = all.filter(p => p !== "booking_days")

  it("requires every phase when booking_days is enabled", () => {
    expect(requiredPhases(all)).toEqual([...SETTLEMENT_PHASES])
  })

  it("drops collecting_bookings when booking_days is off", () => {
    expect(requiredPhases(noBookings)).toEqual([
      "collecting_expenses",
      "reviewing",
      "split_policy",
      "closed",
    ])
  })

  it("matches the legacy next/prev chain with all parameters", () => {
    const phases = requiredPhases(all)
    expect(nextPhaseIn(phases, "collecting_expenses")).toBe(
      "collecting_bookings",
    )
    expect(nextPhaseIn(phases, "collecting_bookings")).toBe("reviewing")
    expect(nextPhaseIn(phases, "reviewing")).toBe("split_policy")
    expect(nextPhaseIn(phases, "split_policy")).toBeNull()
    expect(nextPhaseIn(phases, "closed")).toBeNull()
    expect(prevPhaseIn(phases, "collecting_expenses")).toBeNull()
    expect(prevPhaseIn(phases, "reviewing")).toBe("collecting_bookings")
    expect(prevPhaseIn(phases, "split_policy")).toBe("reviewing")
    expect(prevPhaseIn(phases, "closed")).toBeNull()
  })

  it("skips the booking phase in both directions when not required", () => {
    const phases = requiredPhases(noBookings)
    expect(nextPhaseIn(phases, "collecting_expenses")).toBe("reviewing")
    expect(prevPhaseIn(phases, "reviewing")).toBe("collecting_expenses")
  })

  it("advances out of a phase that is no longer required", () => {
    const phases = requiredPhases(noBookings)
    expect(nextPhaseIn(phases, "collecting_bookings")).toBe("reviewing")
    expect(prevPhaseIn(phases, "collecting_bookings")).toBe(
      "collecting_expenses",
    )
  })
})

describe("phaseAtLeast", () => {
  it("is true at or past the target and false before it", () => {
    expect(phaseAtLeast("reviewing", "reviewing")).toBe(true)
    expect(phaseAtLeast("closed", "reviewing")).toBe(true)
    expect(phaseAtLeast("collecting_expenses", "reviewing")).toBe(false)
  })
})
