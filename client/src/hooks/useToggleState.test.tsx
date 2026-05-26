import { act, renderHook } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { useToggleState } from "./useToggleState"

describe("useToggleState", () => {
  test("defaults to false", () => {
    const { result } = renderHook(() => useToggleState())
    expect(result.current.value).toBe(false)
  })

  test("respects the initial value", () => {
    const { result } = renderHook(() => useToggleState(true))
    expect(result.current.value).toBe(true)
  })

  test("open / close / toggle drive the value", () => {
    const { result } = renderHook(() => useToggleState())

    act(() => { result.current.open() })
    expect(result.current.value).toBe(true)

    act(() => { result.current.close() })
    expect(result.current.value).toBe(false)

    act(() => { result.current.toggle() })
    expect(result.current.value).toBe(true)

    act(() => { result.current.toggle() })
    expect(result.current.value).toBe(false)
  })

  test("setValue replaces the value directly", () => {
    const { result } = renderHook(() => useToggleState())

    act(() => { result.current.setValue(true) })
    expect(result.current.value).toBe(true)

    act(() => { result.current.setValue(false) })
    expect(result.current.value).toBe(false)
  })

  test("handlers are stable across renders", () => {
    const { result, rerender } = renderHook(() => useToggleState())
    const first = {
      open: result.current.open,
      close: result.current.close,
      toggle: result.current.toggle,
    }

    rerender()

    expect(result.current.open).toBe(first.open)
    expect(result.current.close).toBe(first.close)
    expect(result.current.toggle).toBe(first.toggle)
  })
})
