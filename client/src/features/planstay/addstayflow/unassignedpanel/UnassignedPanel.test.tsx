import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import i18n from "@/i18n"
import { UnassignedPanel } from "./UnassignedPanel.tsx"

await i18n.changeLanguage("en")

function makeConflicts(overCapacityBy: number) {
  return {
    overlappingBookings: [],
    perRoom: [],
    property: { totalCapacity: 0, totalPlaced: 0, overCapacityBy },
  }
}

describe("UnassignedPanel", () => {
  test("renders the count of unassigned occupants", () => {
    render(
      <UnassignedPanel
        occupants={[
          { user_id: 1, queued: false },
          { user_id: 2, queued: false },
        ]}
        conflicts={makeConflicts(0)}
        onQueue={vi.fn()}
      />,
    )
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  test("Queue checkbox is disabled with no occupants", () => {
    render(
      <UnassignedPanel
        occupants={[]}
        conflicts={undefined}
        onQueue={vi.fn()}
      />,
    )
    expect(screen.getByRole("checkbox", { name: /queue/i })).toBeDisabled()
  })

  test("Queue checkbox is checked when every occupant is queued", () => {
    render(
      <UnassignedPanel
        occupants={[
          { user_id: 1, queued: true },
          { user_id: 2, queued: true },
        ]}
        conflicts={undefined}
        onQueue={vi.fn()}
      />,
    )
    expect(screen.getByRole("checkbox", { name: /queue/i })).toBeChecked()
  })

  test("clicking Queue calls onQueue for each occupant with checked=true", async () => {
    const onQueue = vi.fn()
    render(
      <UnassignedPanel
        occupants={[
          { user_id: 1, queued: false },
          { user_id: 7, queued: false },
        ]}
        conflicts={undefined}
        onQueue={onQueue}
      />,
    )
    await userEvent.click(screen.getByRole("checkbox", { name: /queue/i }))
    expect(onQueue).toHaveBeenCalledTimes(2)
    expect(onQueue).toHaveBeenNthCalledWith(1, 1, true)
    expect(onQueue).toHaveBeenNthCalledWith(2, 7, true)
  })
})
