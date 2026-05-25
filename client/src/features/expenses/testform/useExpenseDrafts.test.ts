import { act, renderHook } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { useExpenseDrafts } from "./useExpenseDrafts.ts"

describe("useExpenseDrafts", () => {
  test("starts empty with total 0", () => {
    const { result } = renderHook(() => useExpenseDrafts())
    expect(result.current.drafts).toEqual([])
    expect(result.current.total).toBe(0)
  })

  test("add appends drafts and updates total", () => {
    const { result } = renderHook(() => useExpenseDrafts())
    act(() => { result.current.add("food", 100) })
    act(() => { result.current.add("gas", 50) })
    expect(result.current.drafts).toHaveLength(2)
    expect(result.current.drafts[0]?.category).toBe("food")
    expect(result.current.drafts[1]?.amount).toBe(50)
    expect(result.current.total).toBe(150)
  })

  test("each added draft gets a unique id", () => {
    const { result } = renderHook(() => useExpenseDrafts())
    act(() => {
      result.current.add("food", 1)
      result.current.add("food", 1)
      result.current.add("food", 1)
    })
    const ids = result.current.drafts.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test("remove drops the matching draft", () => {
    const { result } = renderHook(() => useExpenseDrafts())
    act(() => { result.current.add("food", 100) })
    act(() => { result.current.add("gas", 50) })
    const removedId = result.current.drafts[0]!.id
    act(() => { result.current.remove(removedId) })
    expect(result.current.drafts).toHaveLength(1)
    expect(result.current.drafts[0]?.category).toBe("gas")
    expect(result.current.total).toBe(50)
  })

  test("reset clears all drafts", () => {
    const { result } = renderHook(() => useExpenseDrafts())
    act(() => { result.current.add("food", 100) })
    act(() => { result.current.reset() })
    expect(result.current.drafts).toEqual([])
    expect(result.current.total).toBe(0)
  })
})
