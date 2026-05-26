import { describe, expect, test } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useHeadVisibility } from "./useHeadVisibility"

describe("useHeadVisibility", () => {
  test("starts empty", () => {
    const { result } = renderHook(() => useHeadVisibility())
    expect(result.current.visibleIds.size).toBe(0)
  })

  test("toggle adds an id when missing", () => {
    const { result } = renderHook(() => useHeadVisibility())
    act(() => {
      result.current.toggle(5)
    })
    expect(result.current.visibleIds.has(5)).toBe(true)
  })

  test("toggle removes an id when present", () => {
    const { result } = renderHook(() => useHeadVisibility())
    act(() => {
      result.current.toggle(5)
    })
    act(() => {
      result.current.toggle(5)
    })
    expect(result.current.visibleIds.has(5)).toBe(false)
  })

  test("toggling different ids accumulates them", () => {
    const { result } = renderHook(() => useHeadVisibility())
    act(() => {
      result.current.toggle(1)
    })
    act(() => {
      result.current.toggle(2)
    })
    act(() => {
      result.current.toggle(3)
    })
    expect([...result.current.visibleIds].sort()).toEqual([1, 2, 3])
  })

  test("toggling does not mutate the previous Set instance", () => {
    const { result } = renderHook(() => useHeadVisibility())
    const before = result.current.visibleIds
    act(() => {
      result.current.toggle(1)
    })
    const after = result.current.visibleIds
    expect(after).not.toBe(before)
    expect(before.size).toBe(0)
  })
})
