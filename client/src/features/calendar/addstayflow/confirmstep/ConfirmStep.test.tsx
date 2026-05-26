import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import i18n from "@/i18n"
import { ConfirmStep } from "./ConfirmStep.tsx"

await i18n.changeLanguage("en")
import type {
  BookingDraft,
  PreviewConflicts,
} from "@/features/calendar/booking-logic"

function makeDraft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return {
    property_id: 1,
    booker_id: 1,
    start_date: "2026-07-01",
    end_date: "2026-07-03",
    status: "confirmed",
    notes: "",
    occupants: [{ user_id: 1, room_id: null, queued: false }],
    ...overrides,
  }
}

function makeConflicts(over: Partial<PreviewConflicts> = {}): PreviewConflicts {
  return {
    overlappingBookings: [],
    perRoom: [],
    property: { totalCapacity: 4, totalPlaced: 4, overCapacityBy: 0 },
    ...over,
  }
}

describe("ConfirmStep", () => {
  test("renders property-over-capacity message when applicable", () => {
    render(
      <ConfirmStep
        draft={makeDraft()}
        conflicts={makeConflicts({
          property: { totalCapacity: 4, totalPlaced: 5, overCapacityBy: 1 },
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isMutating={false}
        roomOverCapacityDays={new Map()}
      />,
    )
    expect(screen.getByText(/property over capacity by 1/i)).toBeInTheDocument()
  })

  test("Cancel triggers onCancel", async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmStep
        draft={makeDraft()}
        conflicts={makeConflicts()}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        isMutating={false}
        roomOverCapacityDays={new Map()}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("Request anyway marks property-overflow occupants as queued", async () => {
    const onConfirm = vi.fn()
    const draft = makeDraft({
      occupants: [
        { user_id: 1, room_id: 5, queued: false },
        { user_id: 2, room_id: null, queued: false },
        { user_id: 3, room_id: null, queued: false },
      ],
    })
    render(
      <ConfirmStep
        draft={draft}
        conflicts={makeConflicts({
          property: { totalCapacity: 2, totalPlaced: 3, overCapacityBy: 1 },
        })}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isMutating={false}
        roomOverCapacityDays={new Map()}
      />,
    )
    await userEvent.click(
      screen.getByRole("button", { name: /request anyway/i }),
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const submitted: BookingDraft = onConfirm.mock.calls[0][0]
    // Last unassigned wins → user 3 queued, user 2 unchanged
    expect(submitted.occupants.find(o => o.user_id === 3)?.queued).toBe(true)
    expect(submitted.occupants.find(o => o.user_id === 2)?.queued).toBe(false)
    expect(submitted.occupants.find(o => o.user_id === 1)?.queued).toBe(false)
  })

  test("buttons are disabled while mutating", () => {
    render(
      <ConfirmStep
        draft={makeDraft()}
        conflicts={makeConflicts()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isMutating
        roomOverCapacityDays={new Map()}
      />,
    )
    expect(
      screen.getByRole("button", { name: /request anyway/i }),
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled()
  })
})
