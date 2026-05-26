import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { useEditableState } from "./useEditableState"

describe("useEditableState", () => {
  test("starts not editing, draft mirrors initial", () => {
    const { result } = renderHook(() =>
      useEditableState({ initial: "ada", onSave: vi.fn() }),
    )
    expect(result.current.editing).toBe(false)
    expect(result.current.draft).toBe("ada")
    expect(result.current.isPending).toBe(false)
  })

  test("enterEdit flips editing and syncs draft from current initial", () => {
    const { result, rerender } = renderHook(
      ({ initial }: { initial: string }) =>
        useEditableState({ initial, onSave: vi.fn() }),
      { initialProps: { initial: "ada" } },
    )

    rerender({ initial: "lovelace" })
    act(() => { result.current.enterEdit() })

    expect(result.current.editing).toBe(true)
    expect(result.current.draft).toBe("lovelace")
  })

  test("setDraft updates the draft", () => {
    const { result } = renderHook(() =>
      useEditableState({ initial: "ada", onSave: vi.fn() }),
    )

    act(() => { result.current.enterEdit() })
    act(() => { result.current.setDraft("grace") })

    expect(result.current.draft).toBe("grace")
  })

  test("cancelEdit resets draft from initial and exits edit mode", () => {
    const { result } = renderHook(() =>
      useEditableState({ initial: "ada", onSave: vi.fn() }),
    )

    act(() => { result.current.enterEdit() })
    act(() => { result.current.setDraft("grace") })
    act(() => { result.current.cancelEdit() })

    expect(result.current.editing).toBe(false)
    expect(result.current.draft).toBe("ada")
  })

  test("save calls onSave with current draft, exits edit on success", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useEditableState({ initial: "ada", onSave }),
    )

    act(() => { result.current.enterEdit() })
    act(() => { result.current.setDraft("grace") })
    await act(async () => { await result.current.save() })

    expect(onSave).toHaveBeenCalledWith("grace")
    expect(result.current.editing).toBe(false)
    expect(result.current.isPending).toBe(false)
  })

  test("save sets isPending while in flight", async () => {
    let resolveSave!: () => void
    const onSave = vi.fn(
      () => new Promise<void>(resolve => { resolveSave = resolve }),
    )
    const { result } = renderHook(() =>
      useEditableState({ initial: "ada", onSave }),
    )

    act(() => { result.current.enterEdit() })
    let savePromise!: Promise<void>
    act(() => { savePromise = result.current.save() })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    await act(async () => {
      resolveSave()
      await savePromise
    })

    expect(result.current.isPending).toBe(false)
  })

  test("save error keeps editing=true and clears isPending", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() =>
      useEditableState({ initial: "ada", onSave }),
    )

    act(() => { result.current.enterEdit() })
    act(() => { result.current.setDraft("grace") })

    await expect(
      act(async () => { await result.current.save() }),
    ).rejects.toThrow("boom")

    expect(result.current.editing).toBe(true)
    expect(result.current.isPending).toBe(false)
    expect(result.current.draft).toBe("grace")
  })
})
