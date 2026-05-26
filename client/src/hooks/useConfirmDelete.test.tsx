import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { useConfirmDelete } from "./useConfirmDelete"

describe("useConfirmDelete", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("calls onConfirm when the user confirms", () => {
    const onConfirm = vi.fn()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)

    const { result } = renderHook(() =>
      useConfirmDelete("Delete this thing?", onConfirm),
    )
    result.current()

    expect(confirmSpy).toHaveBeenCalledWith("Delete this thing?")
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  test("does not call onConfirm when the user cancels", () => {
    const onConfirm = vi.fn()
    vi.spyOn(window, "confirm").mockReturnValue(false)

    const { result } = renderHook(() =>
      useConfirmDelete("Sure?", onConfirm),
    )
    result.current()

    expect(onConfirm).not.toHaveBeenCalled()
  })

  test("uses the latest message and onConfirm after a re-render", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const firstOnConfirm = vi.fn()
    const secondOnConfirm = vi.fn()

    const { result, rerender } = renderHook(
      ({ message, onConfirm }: { message: string; onConfirm: () => void }) =>
        useConfirmDelete(message, onConfirm),
      { initialProps: { message: "first?", onConfirm: firstOnConfirm } },
    )

    rerender({ message: "second?", onConfirm: secondOnConfirm })
    result.current()

    expect(confirmSpy).toHaveBeenLastCalledWith("second?")
    expect(firstOnConfirm).not.toHaveBeenCalled()
    expect(secondOnConfirm).toHaveBeenCalledOnce()
  })
})
