import { describe, expect, test } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useSplitPolicyForm } from "./useSplitPolicyForm"
import type { SavedPolicy } from "./SavedPolicies"
import type { EligibleOwner, GroupWithMembers } from "./types"

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
]
const owners: EligibleOwner[] = [{ user_group_id: 1, user_group_name: "Alpha" }]

describe("auto-dropping exclusions when who changes", () => {
  test("narrowing the fallback to heads drops a non-head exclusion", () => {
    const { result } = renderHook(() => useSplitPolicyForm(groups, owners))

    // Fallback defaults to all users — excluding Bob is valid here.
    act(() => {
      result.current.addExceptToFallback("user:11")
    })
    expect(result.current.form.fallback.except).toEqual([
      { kind: "user", user_id: 11 },
    ])

    // Narrow participants to heads only; Bob is not a head, so the exclusion
    // is no longer meaningful and is dropped automatically.
    act(() => {
      result.current.addWhoToFallback("heads_only")
    })
    act(() => {
      result.current.removeWhoFromFallback("all_users")
    })
    expect(result.current.form.fallback.except).toEqual([])
  })

  test("a still-valid exclusion is kept when who narrows around it", () => {
    const { result } = renderHook(() => useSplitPolicyForm(groups, owners))

    act(() => {
      result.current.addExceptToFallback("user:10")
    })
    // Alice (10) is a head, so narrowing to heads keeps the exclusion.
    act(() => {
      result.current.addWhoToFallback("heads_only")
    })
    act(() => {
      result.current.removeWhoFromFallback("all_users")
    })
    expect(result.current.form.fallback.except).toEqual([
      { kind: "user", user_id: 10 },
    ])
  })

  test("loading a policy drops exclusions outside the saved who-set", () => {
    const { result } = renderHook(() => useSplitPolicyForm(groups, owners))

    const policy: SavedPolicy = {
      id: 5,
      name: "Legacy",
      created_by_id: 1,
      created_by_name: null,
      config: {
        rules: [
          {
            what: { kind: "total" },
            how: { kind: "equally" },
            who: [{ kind: "heads_only" }],
            except: [
              { kind: "user", user_id: 11 }, // Bob — not a head → dropped
              { kind: "user", user_id: 10 }, // Alice — head → kept
            ],
            when: { kind: "always" },
          },
        ],
        fallback: {
          how: { kind: "equally" },
          who: [{ kind: "all_users" }],
          except: [],
          when: { kind: "always" },
        },
      },
    }

    act(() => {
      result.current.loadForEdit(policy)
    })
    expect(result.current.form.rules[0].except).toEqual([
      { kind: "user", user_id: 10 },
    ])
  })
})
