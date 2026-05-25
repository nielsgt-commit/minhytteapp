import { describe, expect, test } from "vitest"
import { makeStore } from "@/app/store"
import {
  resetUser,
  selectSelectedUserId,
  setSelectedUserId,
  userSlice,
  type UserSliceState,
} from "./userSlice.ts"

const { reducer } = userSlice

describe("userSlice initial state", () => {
  test("selectedUserId is null", () => {
    const state = reducer(undefined, { type: "@@INIT" })
    expect(state).toEqual({ selectedUserId: null })
  })

  test("ignores unknown action types", () => {
    const prev: UserSliceState = { selectedUserId: 42 }
    expect(reducer(prev, { type: "user/unknown" })).toBe(prev)
  })
})

describe("setSelectedUserId", () => {
  test("sets a numeric id", () => {
    const next = reducer(undefined, setSelectedUserId(7))
    expect(next.selectedUserId).toBe(7)
  })

  test("overwrites the previous id", () => {
    const next = reducer({ selectedUserId: 1 }, setSelectedUserId(2))
    expect(next.selectedUserId).toBe(2)
  })

  test("accepts null to clear the id", () => {
    const next = reducer({ selectedUserId: 5 }, setSelectedUserId(null))
    expect(next.selectedUserId).toBeNull()
  })

  test("preserves the value when called with the same id", () => {
    const next = reducer({ selectedUserId: 3 }, setSelectedUserId(3))
    expect(next.selectedUserId).toBe(3)
  })

  test("action creator carries the payload", () => {
    const action = setSelectedUserId(9)
    expect(action).toEqual({
      type: "user/setSelectedUserId",
      payload: 9,
    })
  })
})

describe("resetUser", () => {
  test("returns state to initial after setting an id", () => {
    const seeded = reducer(undefined, setSelectedUserId(42))
    const reset = reducer(seeded, resetUser())
    expect(reset).toEqual({ selectedUserId: null })
  })

  test("is a no-op on initial state", () => {
    const init = reducer(undefined, { type: "@@INIT" })
    expect(reducer(init, resetUser())).toEqual(init)
  })

  test("action has the namespaced type", () => {
    expect(resetUser().type).toBe("user/reset")
  })
})

describe("selectSelectedUserId", () => {
  test("returns null when no user is selected", () => {
    const state = makeStore().getState()
    expect(selectSelectedUserId(state)).toBeNull()
  })

  test("returns the current selected user id", () => {
    const state = makeStore({ user: { selectedUserId: 11 } }).getState()
    expect(selectSelectedUserId(state)).toBe(11)
  })
})

describe("slice metadata", () => {
  test("name is 'user'", () => {
    expect(userSlice.name).toBe("user")
  })

  test("exposes the expected action creators", () => {
    expect(Object.keys(userSlice.actions).sort()).toEqual([
      "reset",
      "setSelectedUserId",
    ])
  })
})
