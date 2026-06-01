import { createRef } from "react"
import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import i18n from "@/i18n"
import { StepDates } from "./StepDates.tsx"

await i18n.changeLanguage("en")

function baseProps() {
  return {
    isActive: true,
    rowRef: createRef<HTMLDivElement>(),
    inputRef: createRef<HTMLInputElement>(),
    totalBeds: 10,
    occupiedBeds: null as number | null,
    overlappingBookings: [],
    overlappingPriorityWeeks: [],
    hasStartDate: false,
    stepClass: "step",
    stepActiveClass: "active",
  }
}

describe("StepDates availability", () => {
  test("shows prompt when no dates selected yet", () => {
    render(<StepDates {...baseProps()} />)
    expect(
      screen.getByText(/pick dates to see availability/i),
    ).toBeInTheDocument()
  })

  test("renders 'High availability' tag when most beds are free", () => {
    render(<StepDates {...baseProps()} occupiedBeds={2} />)
    expect(screen.getByText("High availability")).toBeInTheDocument()
  })

  test("renders 'At capacity' tag when fully booked", () => {
    render(<StepDates {...baseProps()} occupiedBeds={10} />)
    expect(screen.getByText("At capacity")).toBeInTheDocument()
  })

  test("renders 'Almost at capacity' tag in the 70–100% band", () => {
    render(<StepDates {...baseProps()} occupiedBeds={8} />)
    expect(screen.getByText("Almost at capacity")).toBeInTheDocument()
  })
})

describe("StepDates overlapping data", () => {
  test("lists overlapping occupants and queued markers", () => {
    render(
      <StepDates
        {...baseProps()}
        occupiedBeds={3}
        hasStartDate
        overlappingBookings={[
          {
            occupants: [
              { user_id: 1, queued: false, user_name: "Alice" },
              { user_id: 2, queued: true, user_name: "Bob" },
            ],
          },
        ]}
      />,
    )
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
    expect(screen.getByText(/Bob\?/)).toBeInTheDocument()
  })

  test("renders priority-week tags with iso week number and owner name", () => {
    render(
      <StepDates
        {...baseProps()}
        occupiedBeds={0}
        hasStartDate
        overlappingPriorityWeeks={[{ iso_week: 29, owner_name: "Family" }]}
      />,
    )
    expect(screen.getByText(/Family/)).toBeInTheDocument()
  })

  test("shows 'no other bookings' message when range is empty and no overlap", () => {
    render(<StepDates {...baseProps()} occupiedBeds={0} hasStartDate />)
    expect(
      screen.getByText(/no other planned stays in this period/i),
    ).toBeInTheDocument()
  })
})
