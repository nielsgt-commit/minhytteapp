import { describe, expect, test } from "vitest"
import {
  type ExceptItem,
  type GroupWithMembers,
  INITIAL_FORM,
  OCCUPANCY_DAYS_PRESET,
  type OccupancyWindow,
  PARAMETER_DESCRIPTION,
  PARAMETER_LABEL,
  SPLIT_POLICY_PARAMETERS,
  type What,
  type When,
  type Who,
  addCategory,
  allUsersInProperty,
  categoryIds,
  childWeightLabel,
  decodeExcept,
  decodeWhen,
  decodeWho,
  decodeWindow,
  deriveParameters,
  describeExcept,
  describeWhat,
  describeWhen,
  describeWho,
  describeWhoList,
  describeWindow,
  encodeExcept,
  encodeWhen,
  encodeWho,
  encodeWindow,
  nameForCategory,
  removeCategory,
  nameForGroup,
  nameForUser,
  normalizeWho,
  participantsFromWho,
} from "./types"

const groups: GroupWithMembers[] = [
  {
    id: 1,
    name: "Alpha",
    is_family: true,
    members: [
      { user_id: 10, user_name: "Alice", is_head: true },
      { user_id: 11, user_name: "Bob", is_head: false },
    ],
  },
  {
    id: 2,
    name: "Beta",
    is_family: false,
    members: [
      { user_id: 11, user_name: "Bob", is_head: false },
      { user_id: 12, user_name: "Carol", is_head: false },
    ],
  },
]

const categories = [
  { id: 100, name: "Food" },
  { id: 101, name: "Gas" },
]

describe("encodeWhen / decodeWhen", () => {
  test("round-trips every eligibility kind", () => {
    const cases: When[] = [
      { kind: "always" },
      { kind: "present_when_expense_added" },
      { kind: "present_this_year" },
      { kind: "present_any_priority_week" },
      { kind: "present_priority_week", user_group_id: 7 },
    ]
    for (const w of cases) {
      expect(decodeWhen(encodeWhen(w))).toEqual(w)
    }
  })
})

describe("encodeWindow / decodeWindow", () => {
  test("round-trips static window kinds", () => {
    const cases: OccupancyWindow[] = [
      { kind: "year" },
      { kind: "any_priority_week" },
    ]
    for (const w of cases) {
      expect(decodeWindow(encodeWindow(w))).toEqual(w)
    }
  })

  test("round-trips priority_week with user_group_id", () => {
    const w: OccupancyWindow = { kind: "priority_week", user_group_id: 42 }
    expect(encodeWindow(w)).toBe("priority_week:42")
    expect(decodeWindow("priority_week:42")).toEqual(w)
  })
})

describe("categoryIds / addCategory / removeCategory", () => {
  test("total has no selected categories", () => {
    expect(categoryIds({ kind: "total" })).toEqual([])
  })

  test("adding categories accumulates unique ids", () => {
    let w: What = { kind: "total" }
    w = addCategory(w, 7)
    expect(w).toEqual({ kind: "category", category_ids: [7] } satisfies What)
    w = addCategory(w, 9)
    expect(w).toEqual({ kind: "category", category_ids: [7, 9] } satisfies What)
    // adding a duplicate is a no-op
    expect(addCategory(w, 7)).toBe(w)
  })

  test("removing the last category collapses back to total", () => {
    const w: What = { kind: "category", category_ids: [7, 9] }
    expect(removeCategory(w, 7)).toEqual({
      kind: "category",
      category_ids: [9],
    } satisfies What)
    expect(removeCategory({ kind: "category", category_ids: [9] }, 9)).toEqual({
      kind: "total",
    } satisfies What)
  })
})

describe("encodeWho / decodeWho", () => {
  test("round-trips every kind", () => {
    const cases: Who[] = [
      { kind: "all_users" },
      { kind: "heads_only" },
      { kind: "main_groups" },
      { kind: "user_group", group_id: 5 },
      { kind: "user", user_id: 9 },
    ]
    for (const w of cases) {
      expect(decodeWho(encodeWho(w))).toEqual(w)
    }
  })

  test("falls back to all_users when input is unrecognized", () => {
    expect(decodeWho("garbage")).toEqual({ kind: "all_users" })
  })
})

describe("encodeExcept / decodeExcept", () => {
  test("round-trips kids / user / group", () => {
    const cases: ExceptItem[] = [
      { kind: "kids" },
      { kind: "user", user_id: 3 },
      { kind: "group", group_id: 4 },
    ]
    for (const e of cases) {
      expect(decodeExcept(encodeExcept(e))).toEqual(e)
    }
  })

  test("returns null on unknown encoding", () => {
    expect(decodeExcept("nope")).toBeNull()
  })
})

describe("nameFor*", () => {
  test("nameForGroup returns the group name when found", () => {
    expect(nameForGroup(groups, 1)).toBe("Alpha")
  })

  test("nameForGroup falls back to '#id' when missing", () => {
    expect(nameForGroup(groups, 99)).toBe("group #99")
  })

  test("nameForUser searches across all groups", () => {
    expect(nameForUser(groups, 12)).toBe("Carol")
  })

  test("nameForUser falls back to '#id' when not in any group", () => {
    expect(nameForUser(groups, 999)).toBe("user #999")
  })

  test("nameForCategory falls back to '#id' when missing", () => {
    expect(nameForCategory(categories, 100)).toBe("Food")
    expect(nameForCategory(categories, 404)).toBe("category #404")
  })
})

describe("describe*", () => {
  test("describeWhat for total and categories", () => {
    expect(describeWhat({ kind: "total" }, categories)).toBe("total")
    expect(
      describeWhat({ kind: "category", category_ids: [101] }, categories),
    ).toBe("Gas")
    expect(
      describeWhat({ kind: "category", category_ids: [100, 101] }, categories),
    ).toBe("Food, Gas")
    // Legacy rows still carry a single `category_id`; describeWhat must not crash.
    expect(
      describeWhat(
        { kind: "category", category_id: 100 } as unknown as What,
        categories,
      ),
    ).toBe("Food")
  })

  test("describeWho across kinds", () => {
    expect(describeWho({ kind: "all_users" }, groups)).toBe("all users")
    expect(describeWho({ kind: "heads_only" }, groups)).toBe(
      "heads of this property",
    )
    expect(describeWho({ kind: "main_groups" }, groups)).toBe(
      "main owner groups",
    )
    expect(describeWho({ kind: "user_group", group_id: 2 }, groups)).toBe(
      'group "Beta"',
    )
    expect(describeWho({ kind: "user", user_id: 10 }, groups)).toBe("Alice")
  })

  test("describeWhoList returns 'nobody' for empty list and joins with commas", () => {
    expect(describeWhoList([], groups)).toBe("nobody")
    expect(
      describeWhoList(
        [{ kind: "all_users" }, { kind: "user", user_id: 11 }],
        groups,
      ),
    ).toBe("all users, Bob")
  })

  test("describeExcept resolves user / group / kids", () => {
    expect(describeExcept({ kind: "kids" }, groups)).toBe("Kids")
    expect(describeExcept({ kind: "user", user_id: 11 }, groups)).toBe("Bob")
    expect(describeExcept({ kind: "group", group_id: 1 }, groups)).toBe(
      'group "Alpha"',
    )
  })

  test("describeWhen labels eligibility kinds", () => {
    expect(describeWhen({ kind: "always" })).toBe("anytime")
    expect(describeWhen({ kind: "present_this_year" })).toBe(
      "present this year",
    )
    expect(describeWhen({ kind: "present_any_priority_week" })).toBe(
      "present during any priority week",
    )
    expect(
      describeWhen({ kind: "present_priority_week", user_group_id: 1 }, [
        { user_group_id: 1, user_group_name: "Alpha" },
      ]),
    ).toBe("present during Alpha's priority week")
  })

  test("describeWindow resolves owner name or falls back", () => {
    expect(describeWindow({ kind: "year" }, [])).toBe("all stays this year")
    expect(
      describeWindow({ kind: "priority_week", user_group_id: 7 }, [
        { user_group_id: 7, user_group_name: "Dana" },
      ]),
    ).toBe("stays during Dana's priority week")
    expect(
      describeWindow({ kind: "priority_week", user_group_id: 7 }, []),
    ).toBe("stays during a priority week (group #7)")
  })

  test("childWeightLabel maps the presets", () => {
    expect(childWeightLabel(1)).toBe("a full person")
    expect(childWeightLabel(0.5)).toBe("half a person")
    expect(childWeightLabel(0)).toBe("nothing")
  })
})

describe("allUsersInProperty", () => {
  test("dedupes users across groups and sorts by name", () => {
    expect(allUsersInProperty(groups)).toEqual([
      { user_id: 10, user_name: "Alice" },
      { user_id: 11, user_name: "Bob" },
      { user_id: 12, user_name: "Carol" },
    ])
  })

  test("returns empty array when no groups", () => {
    expect(allUsersInProperty([])).toEqual([])
  })
})

describe("normalizeWho", () => {
  test("returns the array when given an array", () => {
    const arr: Who[] = [{ kind: "all_users" }]
    expect(normalizeWho(arr)).toBe(arr)
  })

  test("wraps a single Who object in an array", () => {
    expect(normalizeWho({ kind: "heads_only" })).toEqual([
      { kind: "heads_only" },
    ])
  })

  test("defaults to [{ all_users }] for null/undefined/primitive", () => {
    expect(normalizeWho(null)).toEqual([{ kind: "all_users" }])
    expect(normalizeWho(undefined)).toEqual([{ kind: "all_users" }])
    expect(normalizeWho("nope")).toEqual([{ kind: "all_users" }])
  })
})

describe("parameters", () => {
  test("INITIAL_FORM enables every parameter", () => {
    expect(INITIAL_FORM.parameters).toEqual([...SPLIT_POLICY_PARAMETERS])
  })

  test("the occupancy preset only needs booking days", () => {
    expect(OCCUPANCY_DAYS_PRESET.parameters).toEqual(["booking_days"])
  })

  test("every parameter has a label and description", () => {
    for (const p of SPLIT_POLICY_PARAMETERS) {
      expect(PARAMETER_LABEL[p]).toBeTruthy()
      expect(PARAMETER_DESCRIPTION[p]).toBeTruthy()
    }
  })
})

describe("deriveParameters", () => {
  const year = { window: { kind: "year" } as const } as const
  const equalRule = {
    how: { kind: "equally" } as const,
    when: { kind: "always" } as const,
  }
  const base = {
    rules: [equalRule],
    fallback: equalRule,
    occupancy: { ...year, include_extra_guests: false, child_weight: 1 },
  }

  test("a plain split-equally policy needs only categories + participants", () => {
    expect(deriveParameters(base)).toEqual(["expense_categories", "participants"])
  })

  test("a person-days rule adds booking_days", () => {
    expect(
      deriveParameters({
        ...base,
        rules: [{ ...equalRule, how: { kind: "weighted_by_occupancy" } }],
      }),
    ).toContain("booking_days")
  })

  test("an ownership rule adds ownership but not booking_days", () => {
    const params = deriveParameters({
      ...base,
      fallback: { ...equalRule, how: { kind: "by_ownership_pct" } },
    })
    expect(params).toContain("ownership")
    expect(params).not.toContain("booking_days")
  })

  test("a presence condition implies time_conditions and booking_days", () => {
    const params = deriveParameters({
      ...base,
      rules: [{ ...equalRule, when: { kind: "present_this_year" } }],
    })
    expect(params).toContain("time_conditions")
    expect(params).toContain("booking_days")
  })

  test("a priority-week window only counts when person-days are used", () => {
    const priority = {
      window: { kind: "any_priority_week" } as const,
      include_extra_guests: false,
      child_weight: 1,
    }
    // Window set but no person-days rule => irrelevant, no booking_days.
    expect(
      deriveParameters({ ...base, occupancy: priority }),
    ).not.toContain("time_conditions")
    // With a person-days rule the window becomes meaningful.
    expect(
      deriveParameters({
        rules: [{ ...equalRule, how: { kind: "weighted_by_occupancy" } }],
        fallback: equalRule,
        occupancy: priority,
      }),
    ).toContain("time_conditions")
  })

  test("a rule-less fallback policy drops expense_categories", () => {
    expect(deriveParameters({ ...base, rules: [] })).toEqual(["participants"])
  })
})

describe("participantsFromWho", () => {
  // Alpha (group 1) is the main owner group; Alice is its only head.
  const owners = [{ user_group_id: 1, user_group_name: "Alpha" }]
  const ids = (s: Set<number>) => [...s].sort((a, b) => a - b)

  test("heads_only resolves to head members of family groups", () => {
    const r = participantsFromWho([{ kind: "heads_only" }], groups, owners)
    expect(ids(r.userIds)).toEqual([10]) // Alice, not Bob
    expect(ids(r.groupIds)).toEqual([]) // no group is fully heads
  })

  test("a picked group resolves to its members and itself", () => {
    const r = participantsFromWho(
      [{ kind: "user_group", group_id: 2 }],
      groups,
      owners,
    )
    expect(ids(r.userIds)).toEqual([11, 12])
    expect(ids(r.groupIds)).toEqual([2])
  })

  test("main_groups resolves to the owner group members", () => {
    const r = participantsFromWho([{ kind: "main_groups" }], groups, owners)
    expect(ids(r.userIds)).toEqual([10, 11])
    expect(ids(r.groupIds)).toEqual([1])
  })

  test("all_users includes everyone and every whole group", () => {
    const r = participantsFromWho([{ kind: "all_users" }], groups, owners)
    expect(ids(r.userIds)).toEqual([10, 11, 12])
    expect(ids(r.groupIds)).toEqual([1, 2])
  })
})
