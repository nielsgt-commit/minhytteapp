import { act, renderHook } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { useExpenseEditor } from "./useExpenseEditor.ts"

describe("useExpenseEditor", () => {
  test("starts closed with empty amount", () => {
    const { result } = renderHook(() => useExpenseEditor())
    expect(result.current.openCategory).toBeNull()
    expect(result.current.amount).toBe("")
  })

  test("open sets the category and resets amount", () => {
    const { result } = renderHook(() => useExpenseEditor())
    act(() => {
      result.current.setAmount("999")
    })
    act(() => {
      result.current.open("food")
    })
    expect(result.current.openCategory).toBe("food")
    expect(result.current.amount).toBe("")
  })

  test("setAmount updates the amount string", () => {
    const { result } = renderHook(() => useExpenseEditor())
    act(() => {
      result.current.setAmount("42")
    })
    expect(result.current.amount).toBe("42")
  })

  test("close clears category and amount", () => {
    const { result } = renderHook(() => useExpenseEditor())
    act(() => {
      result.current.open("food")
    })
    act(() => {
      result.current.setAmount("42")
    })
    act(() => {
      result.current.close()
    })
    expect(result.current.openCategory).toBeNull()
    expect(result.current.amount).toBe("")
  })
})
