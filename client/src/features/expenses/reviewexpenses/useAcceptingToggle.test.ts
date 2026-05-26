import { act, renderHook } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { useAcceptingToggle } from "./useAcceptingToggle.ts"

describe("useAcceptingToggle", () => {
  test("starts in accepting state with no warning", () => {
    const { result } = renderHook(() => useAcceptingToggle(0))
    expect(result.current.stillAccepting).toBe(true)
    expect(result.current.warningCount).toBeNull()
  })

  test("blocks turning off while items remain and surfaces the count", () => {
    const { result } = renderHook(() => useAcceptingToggle(3))
    act(() => {
      result.current.onSwitchChange(false)
    })
    expect(result.current.stillAccepting).toBe(true)
    expect(result.current.warningCount).toBe(3)
  })

  test("allows turning off once nothing remains and clears the warning", () => {
    const { result, rerender } = renderHook(
      ({ count }: { count: number }) => useAcceptingToggle(count),
      { initialProps: { count: 2 } },
    )
    act(() => {
      result.current.onSwitchChange(false)
    })
    expect(result.current.warningCount).toBe(2)

    rerender({ count: 0 })
    act(() => {
      result.current.onSwitchChange(false)
    })
    expect(result.current.stillAccepting).toBe(false)
    expect(result.current.warningCount).toBeNull()
  })

  test("turning back on always clears the warning", () => {
    const { result } = renderHook(() => useAcceptingToggle(1))
    act(() => {
      result.current.onSwitchChange(false)
    })
    expect(result.current.warningCount).toBe(1)
    act(() => {
      result.current.onSwitchChange(true)
    })
    expect(result.current.stillAccepting).toBe(true)
    expect(result.current.warningCount).toBeNull()
  })
})
