import { describe, expect, it } from "vitest"
import {
  type SplitInput,
  computePolicySplit,
  computeTransfers,
  inclusiveDayCount,
} from "./settlementSplit.ts"
import {
  SPLIT_POLICY_PARAMETERS,
  type SplitPolicyConfig,
  type SplitPolicyFallback,
} from "../shared/splitPolicy.ts"

const ALL = [...SPLIT_POLICY_PARAMETERS]

const equallyMainGroups: SplitPolicyFallback = {
  how: { kind: "equally" },
  who: [{ kind: "main_groups" }],
  except: [],
  when: { kind: "always" },
}

// Two main owner groups: A (users 1, 2 — 2 is a child) and B (users 3, 4).
// User 1 and 3 are heads. Group C (id 30) is a non-family helper group
// containing user 3.
function makeInput(overrides: Partial<SplitInput> = {}): SplitInput {
  return {
    year: 2026,
    mainGroups: [
      { id: 10, name: "A", ownership_pct: 70 },
      { id: 20, name: "B", ownership_pct: 30 },
    ],
    groupMembers: new Map([
      [10, [1, 2]],
      [20, [3, 4]],
      [30, [3]],
    ]),
    userToMainGroup: new Map([
      [1, 10],
      [2, 10],
      [3, 20],
      [4, 20],
    ]),
    headUserIds: new Set([1, 3]),
    childUserIds: new Set([2]),
    expenses: [],
    categoryNameById: new Map([
      [1, "Food"],
      [2, "Firewood"],
    ]),
    bookings: [],
    priorityWeeks: [],
    ...overrides,
  }
}

function expense(
  amount: number,
  payer_id: number,
  extra: Partial<SplitInput["expenses"][number]> = {},
) {
  return {
    amount,
    payer_id,
    reimbursed_by_id: null,
    expense_types: [],
    date: "2026-07-01",
    ...extra,
  }
}

function config(
  fallback: SplitPolicyFallback,
  rules: SplitPolicyConfig["rules"] = [],
  parameters?: SplitPolicyConfig["parameters"],
  occupancy?: SplitPolicyConfig["occupancy"],
): SplitPolicyConfig {
  return { parameters, rules, fallback, occupancy }
}

function sharesByGroup(result: ReturnType<typeof computePolicySplit>) {
  return Object.fromEntries(
    result.groups.map(g => [g.group_name, g.total_share]),
  )
}

describe("inclusiveDayCount", () => {
  it("counts both endpoints", () => {
    expect(inclusiveDayCount("2026-07-01", "2026-07-01")).toBe(1)
    expect(inclusiveDayCount("2026-07-01", "2026-07-07")).toBe(7)
  })
})

describe("computePolicySplit", () => {
  it("splits equally between main groups", () => {
    const input = makeInput({ expenses: [expense(100, 1)] })
    const result = computePolicySplit(config(equallyMainGroups), input, ALL)
    expect(result.total_reimbursed).toBe(100)
    expect(sharesByGroup(result)).toEqual({ A: 50, B: 50 })
    const a = result.groups.find(g => g.group_name === "A")
    expect(a?.total_paid).toBe(100)
    expect(a?.net).toBe(50)
  })

  it("splits by ownership percentage", () => {
    const input = makeInput({ expenses: [expense(1000, 3)] })
    const result = computePolicySplit(
      config({ ...equallyMainGroups, how: { kind: "by_ownership_pct" } }),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 700, B: 300 })
  })

  it("falls back to equally when all ownership weights are zero", () => {
    const input = makeInput({
      mainGroups: [
        { id: 10, name: "A", ownership_pct: 0 },
        { id: 20, name: "B", ownership_pct: 0 },
      ],
      expenses: [expense(100, 1)],
    })
    const result = computePolicySplit(
      config({ ...equallyMainGroups, how: { kind: "by_ownership_pct" } }),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 50, B: 50 })
  })

  it("weights by occupancy and matches the legacy rounding", () => {
    // A: user 1 occupies 7 days; B: user 3 occupies 3 days.
    const input = makeInput({
      bookings: [
        {
          booker_id: 1,
          start_date: "2026-07-01",
          end_date: "2026-07-07",
          occupant_user_ids: [1],
          extra_count: 0,
        },
        {
          booker_id: 3,
          start_date: "2026-08-01",
          end_date: "2026-08-03",
          occupant_user_ids: [3],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 1)],
    })
    const result = computePolicySplit(
      config({
        ...equallyMainGroups,
        how: { kind: "weighted_by_occupancy" },
      }),
      input,
      ALL,
    )
    expect(result.total_booking_days).toBe(10)
    expect(sharesByGroup(result)).toEqual({ A: 70, B: 30 })
    expect(result.groups.find(g => g.group_name === "A")?.booking_days).toBe(7)
  })

  it("credits extra guests to the booker's group only when enabled", () => {
    const bookings = [
      {
        booker_id: 1,
        start_date: "2026-07-01",
        end_date: "2026-07-05",
        occupant_user_ids: [1],
        extra_count: 1,
      },
      {
        booker_id: 3,
        start_date: "2026-08-01",
        end_date: "2026-08-05",
        occupant_user_ids: [3],
        extra_count: 0,
      },
    ]
    const withExtras = computePolicySplit(
      config(
        { ...equallyMainGroups, how: { kind: "weighted_by_occupancy" } },
        [],
        undefined,
        {
          window: { kind: "year" },
          include_extra_guests: true,
          child_weight: 1,
        },
      ),
      makeInput({ bookings, expenses: [expense(150, 1)] }),
      ALL,
    )
    expect(sharesByGroup(withExtras)).toEqual({ A: 100, B: 50 })

    const withoutExtras = computePolicySplit(
      config(
        { ...equallyMainGroups, how: { kind: "weighted_by_occupancy" } },
        [],
        undefined,
        {
          window: { kind: "year" },
          include_extra_guests: false,
          child_weight: 1,
        },
      ),
      makeInput({ bookings, expenses: [expense(150, 1)] }),
      ALL,
    )
    expect(sharesByGroup(withoutExtras)).toEqual({ A: 75, B: 75 })
  })

  it("falls back to equally when occupancy weights are all zero", () => {
    const input = makeInput({ expenses: [expense(100, 1)] })
    const result = computePolicySplit(
      config({
        ...equallyMainGroups,
        how: { kind: "weighted_by_occupancy" },
      }),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 50, B: 50 })
  })

  it("routes expenses to the first matching category rule", () => {
    const input = makeInput({
      expenses: [
        expense(100, 1, { expense_types: ["Food"] }),
        expense(60, 1, { expense_types: ["Firewood"] }),
      ],
    })
    const result = computePolicySplit(
      config(equallyMainGroups, [
        {
          what: { kind: "category", category_ids: [1] },
          how: { kind: "by_ownership_pct" },
          who: [{ kind: "main_groups" }],
          except: [],
          when: { kind: "always" },
        },
      ]),
      input,
      ALL,
    )
    // Food by ownership (70/30), Firewood equally (30/30).
    expect(sharesByGroup(result)).toEqual({ A: 100, B: 60 })
  })

  it("lets an early total rule shadow later rules", () => {
    const input = makeInput({
      expenses: [expense(100, 1, { expense_types: ["Food"] })],
    })
    const result = computePolicySplit(
      config(equallyMainGroups, [
        {
          what: { kind: "total" },
          how: { kind: "equally" },
          who: [{ kind: "main_groups" }],
          except: [],
          when: { kind: "always" },
        },
        {
          what: { kind: "category", category_ids: [1] },
          how: { kind: "by_ownership_pct" },
          who: [{ kind: "main_groups" }],
          except: [],
          when: { kind: "always" },
        },
      ]),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 50, B: 50 })
  })

  it("matches an expense against any category in a multi-category rule", () => {
    const input = makeInput({
      expenses: [
        expense(100, 1, { expense_types: ["Food"] }),
        expense(100, 1, { expense_types: ["Firewood"] }),
        expense(80, 1, { expense_types: ["Other"] }),
      ],
    })
    const result = computePolicySplit(
      config(equallyMainGroups, [
        {
          // Food + Firewood by ownership (70/30); "Other" falls to the
          // equally-split fallback.
          what: { kind: "category", category_ids: [1, 2] },
          how: { kind: "by_ownership_pct" },
          who: [{ kind: "main_groups" }],
          except: [],
          when: { kind: "always" },
        },
      ]),
      input,
      ALL,
    )
    // 200 by ownership → A 140, B 60; 80 equally → A 40, B 40.
    expect(sharesByGroup(result)).toEqual({ A: 180, B: 100 })
  })

  it("expands user_group whos and applies kids/user excepts", () => {
    const input = makeInput({ expenses: [expense(90, 1)] })
    const result = computePolicySplit(
      config({
        how: { kind: "equally" },
        who: [{ kind: "all_users" }],
        except: [{ kind: "kids" }],
        when: { kind: "always" },
      }),
      input,
      ALL,
    )
    // Users 1, 3, 4 (2 is a child): A gets 1/3, B gets 2/3.
    expect(sharesByGroup(result)).toEqual({ A: 30, B: 60 })
  })

  it("targets a specific group's members", () => {
    const input = makeInput({ expenses: [expense(80, 1)] })
    const result = computePolicySplit(
      config({
        how: { kind: "equally" },
        who: [{ kind: "user_group", group_id: 30 }],
        except: [],
        when: { kind: "always" },
      }),
      input,
      ALL,
    )
    // Group 30 contains only user 3, who folds into main group B.
    expect(sharesByGroup(result)).toEqual({ A: 0, B: 80 })
  })

  it("filters per expense for present_when_expense_added", () => {
    const input = makeInput({
      bookings: [
        {
          booker_id: 1,
          start_date: "2026-07-01",
          end_date: "2026-07-07",
          occupant_user_ids: [1],
          extra_count: 0,
        },
      ],
      expenses: [
        expense(100, 3, { date: "2026-07-03" }),
        expense(50, 3, { date: "2026-09-01" }),
      ],
    })
    const result = computePolicySplit(
      config({
        how: { kind: "equally" },
        who: [{ kind: "all_users" }],
        except: [],
        when: { kind: "present_when_expense_added" },
      }),
      input,
      ALL,
    )
    // Only user 1 was present on 2026-07-03 → A pays that 100 alone.
    // Nobody present on 2026-09-01 → falls back to all main groups equally.
    expect(sharesByGroup(result)).toEqual({ A: 125, B: 25 })
  })

  it("filters participants by presence during a specific priority week", () => {
    const input = makeInput({
      priorityWeeks: [{ user_group_id: 10, iso_week: 28 }],
      bookings: [
        {
          // ISO week 28 of 2026 starts Monday 2026-07-06.
          booker_id: 1,
          start_date: "2026-07-06",
          end_date: "2026-07-12",
          occupant_user_ids: [1],
          extra_count: 0,
        },
        {
          booker_id: 3,
          start_date: "2026-08-01",
          end_date: "2026-08-07",
          occupant_user_ids: [3],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 3)],
    })
    // Only user 1's stay overlaps group 10's priority week, so an equal split
    // among present users goes entirely to group A.
    const result = computePolicySplit(
      config({
        how: { kind: "equally" },
        who: [{ kind: "all_users" }],
        except: [],
        when: { kind: "present_priority_week", user_group_id: 10 },
      }),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 100, B: 0 })
  })

  it("filters participants by presence during any priority week", () => {
    const input = makeInput({
      priorityWeeks: [{ user_group_id: 20, iso_week: 28 }],
      bookings: [
        {
          booker_id: 3,
          start_date: "2026-07-06",
          end_date: "2026-07-12",
          occupant_user_ids: [3],
          extra_count: 0,
        },
        {
          booker_id: 1,
          start_date: "2026-08-01",
          end_date: "2026-08-07",
          occupant_user_ids: [1],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 1)],
    })
    // Only user 3 overlaps a priority week → group B pays it all.
    const result = computePolicySplit(
      config({
        how: { kind: "equally" },
        who: [{ kind: "all_users" }],
        except: [],
        when: { kind: "present_any_priority_week" },
      }),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 0, B: 100 })
  })

  it("scopes person-days to a group's priority week", () => {
    const input = makeInput({
      priorityWeeks: [{ user_group_id: 10, iso_week: 28 }],
      bookings: [
        {
          // ISO week 28 of 2026 starts Monday 2026-07-06.
          booker_id: 1,
          start_date: "2026-07-06",
          end_date: "2026-07-12",
          occupant_user_ids: [1],
          extra_count: 0,
        },
        {
          booker_id: 3,
          start_date: "2026-08-01",
          end_date: "2026-08-07",
          occupant_user_ids: [3],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 3)],
    })
    // Only user 1's stay overlaps group 10's priority week, so only those
    // person-days count; everyone else weighs 0. Group A pays it all.
    const result = computePolicySplit(
      config(
        {
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "all_users" }],
          except: [],
          when: { kind: "always" },
        },
        [],
        undefined,
        {
          window: { kind: "priority_week", user_group_id: 10 },
          include_extra_guests: false,
          child_weight: 1,
        },
      ),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 100, B: 0 })
  })

  it("scopes person-days to a manual month/day range in the settlement year", () => {
    const input = makeInput({
      bookings: [
        {
          booker_id: 1,
          start_date: "2026-07-06",
          end_date: "2026-07-12",
          occupant_user_ids: [1],
          extra_count: 0,
        },
        {
          booker_id: 3,
          start_date: "2026-08-01",
          end_date: "2026-08-07",
          occupant_user_ids: [3],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 3)],
    })
    // 07-01..07-31 resolves to July of the settlement year (2026), so only user
    // 1's stay counts; group A pays all.
    const result = computePolicySplit(
      config(
        {
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "all_users" }],
          except: [],
          when: { kind: "always" },
        },
        [],
        undefined,
        {
          window: { kind: "custom_range", from_md: "07-01", to_md: "07-31" },
          include_extra_guests: false,
          child_weight: 1,
        },
      ),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 100, B: 0 })
  })

  it("wraps a from > to manual range across the new year", () => {
    const input = makeInput({
      bookings: [
        {
          // Late-December stay, inside a 12-20..01-10 winter window.
          booker_id: 1,
          start_date: "2026-12-22",
          end_date: "2026-12-28",
          occupant_user_ids: [1],
          extra_count: 0,
        },
        {
          // July stay, outside the winter window.
          booker_id: 3,
          start_date: "2026-07-01",
          end_date: "2026-07-07",
          occupant_user_ids: [3],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 3)],
    })
    const result = computePolicySplit(
      config(
        {
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "all_users" }],
          except: [],
          when: { kind: "always" },
        },
        [],
        undefined,
        {
          window: { kind: "custom_range", from_md: "12-20", to_md: "01-10" },
          include_extra_guests: false,
          child_weight: 1,
        },
      ),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 100, B: 0 })
  })

  it("counts zero person-days for a malformed manual range", () => {
    const input = makeInput({
      bookings: [
        {
          booker_id: 1,
          start_date: "2026-07-06",
          end_date: "2026-07-12",
          occupant_user_ids: [1],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 1)],
    })
    // Malformed month/day → no valid window → nobody weighs anything, so the
    // weighted split falls back to an equal split across groups.
    const result = computePolicySplit(
      config(
        {
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "all_users" }],
          except: [],
          when: { kind: "always" },
        },
        [],
        undefined,
        {
          window: { kind: "custom_range", from_md: "bogus", to_md: "07-31" },
          include_extra_guests: false,
          child_weight: 1,
        },
      ),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 50, B: 50 })
  })

  it("scales children's person-days by child_weight", () => {
    // A: user 1 (adult) and user 2 (child), 4 days each; B: user 3, 4 days.
    const input = makeInput({
      bookings: [
        {
          booker_id: 1,
          start_date: "2026-07-01",
          end_date: "2026-07-04",
          occupant_user_ids: [1, 2],
          extra_count: 0,
        },
        {
          booker_id: 3,
          start_date: "2026-07-01",
          end_date: "2026-07-04",
          occupant_user_ids: [3],
          extra_count: 0,
        },
      ],
      expenses: [expense(100, 1)],
    })
    // Child weight 0.5: A = 4 + 4×0.5 = 6, B = 4. Total 10 → A 60, B 40.
    const result = computePolicySplit(
      config(
        {
          how: { kind: "weighted_by_occupancy" },
          who: [{ kind: "all_users" }],
          except: [],
          when: { kind: "always" },
        },
        [],
        undefined,
        {
          window: { kind: "year" },
          include_extra_guests: false,
          child_weight: 0.5,
        },
      ),
      input,
      ALL,
    )
    expect(sharesByGroup(result)).toEqual({ A: 60, B: 40 })
  })

  it("computes without any booking data when booking_days is off", () => {
    const parameters = ALL.filter(p => p !== "booking_days")
    const input = makeInput({ expenses: [expense(100, 1)] })
    const result = computePolicySplit(
      config(equallyMainGroups, [], parameters),
      input,
      parameters,
    )
    expect(result.total_booking_days).toBeNull()
    expect(result.groups.every(g => g.booking_days === null)).toBe(true)
    expect(sharesByGroup(result)).toEqual({ A: 50, B: 50 })
  })

  it("keeps shares summing exactly to the total despite rounding", () => {
    const input = makeInput({
      mainGroups: [
        { id: 10, name: "A", ownership_pct: 0 },
        { id: 20, name: "B", ownership_pct: 0 },
        { id: 30, name: "C", ownership_pct: 0 },
      ],
      groupMembers: new Map([
        [10, [1]],
        [20, [3]],
        [30, [5]],
      ]),
      userToMainGroup: new Map([
        [1, 10],
        [3, 20],
        [5, 30],
      ]),
      expenses: [expense(100, 1)],
    })
    const result = computePolicySplit(config(equallyMainGroups), input, ALL)
    const sum = result.groups.reduce((s, g) => s + g.total_share, 0)
    expect(sum).toBe(100)
  })
})

describe("computeTransfers", () => {
  it("matches debtors to creditors greedily", () => {
    const transfers = computeTransfers([
      {
        group_id: 10,
        group_name: "A",
        booking_days: null,
        total_paid: 100,
        total_share: 50,
        net: 50,
      },
      {
        group_id: 20,
        group_name: "B",
        booking_days: null,
        total_paid: 0,
        total_share: 50,
        net: -50,
      },
    ])
    expect(transfers).toEqual([
      {
        from_group_id: 20,
        from_group_name: "B",
        to_group_id: 10,
        to_group_name: "A",
        amount: 50,
      },
    ])
  })
})
