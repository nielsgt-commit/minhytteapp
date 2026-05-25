import { describe, expect, test } from "vitest"
import {
  type ExceptItem,
  type GroupWithMembers,
  type What,
  type When,
  type Who,
  allUsersInProperty,
  decodeExcept,
  decodeWhat,
  decodeWhen,
  decodeWho,
  describeExcept,
  describeWhat,
  describeWhen,
  describeWho,
  describeWhoList,
  encodeExcept,
  encodeWhat,
  encodeWhen,
  encodeWho,
  nameForCategory,
  nameForGroup,
  nameForUser,
  normalizeWho,
} from "./types"

const groups: GroupWithMembers[] = [
  {
    id: 1,
    name: "Alpha",
    is_main: true,
    members: [
      { user_id: 10, user_name: "Alice" },
      { user_id: 11, user_name: "Bob" },
    ],
  },
  {
    id: 2,
    name: "Beta",
    is_main: false,
    members: [{ user_id: 11, user_name: "Bob" }, { user_id: 12, user_name: "Carol" }],
  },
]

const categories = [
  { id: 100, name: "Food" },
  { id: 101, name: "Gas" },
]

describe("encodeWhen / decodeWhen", () => {
  test("round-trips static kinds", () => {
    const cases: When[] = [
      { kind: "always" },
      { kind: "present_when_expense_added" },
      { kind: "present_this_year" },
      { kind: "during_any_priority_week" },
    ]
    for (const w of cases) {
      expect(decodeWhen(encodeWhen(w))).toEqual(w)
    }
  })

  test("round-trips during_priority_week with property_owner_id", () => {
    const w: When = { kind: "during_priority_week", property_owner_id: 42 }
    expect(encodeWhen(w)).toBe("during_priority_week:42")
    expect(decodeWhen("during_priority_week:42")).toEqual(w)
  })
})

describe("encodeWhat / decodeWhat", () => {
  test("encodes total as a bare string", () => {
    expect(encodeWhat({ kind: "total" })).toBe("total")
    expect(decodeWhat("total")).toEqual({ kind: "total" } satisfies What)
  })

  test("round-trips a category", () => {
    const w: What = { kind: "category", category_id: 7 }
    expect(encodeWhat(w)).toBe("category:7")
    expect(decodeWhat("category:7")).toEqual(w)
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
  test("describeWhat for total and category", () => {
    expect(describeWhat({ kind: "total" }, categories)).toBe("total")
    expect(
      describeWhat({ kind: "category", category_id: 101 }, categories),
    ).toBe("Gas")
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

  test("describeWhen resolves owner name or falls back", () => {
    expect(describeWhen({ kind: "always" }, [])).toBe("anytime")
    expect(
      describeWhen(
        { kind: "during_priority_week", property_owner_id: 7 },
        [{ property_owner_id: 7, user_id: 99, user_name: "Dana" }],
      ),
    ).toBe("Dana's priority week")
    expect(
      describeWhen(
        { kind: "during_priority_week", property_owner_id: 7 },
        [],
      ),
    ).toBe("priority week (owner #7)")
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
