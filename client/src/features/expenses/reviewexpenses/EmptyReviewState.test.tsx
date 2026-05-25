import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test-utils/renderWithProviders.tsx"
import { EmptyReviewState } from "./EmptyReviewState.tsx"

describe("EmptyReviewState", () => {
  test("shows '(nothing to review)' for phases other than collecting_expenses", () => {
    renderWithProviders(
      <EmptyReviewState
        phase="reviewing"
        stillAccepting={false}
        next={null}
        advancePending={false}
        advanceError={null}
        onContinue={() => {}}
      />,
    )
    expect(screen.getByText("(nothing to review)")).toBeInTheDocument()
  })

  test("hides the continue button while still accepting new expenses", () => {
    renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        stillAccepting={true}
        next="collecting_bookings"
        advancePending={false}
        advanceError={null}
        onContinue={() => {}}
      />,
    )
    expect(
      screen.queryByRole("button", { name: "Continue to booking days" }),
    ).not.toBeInTheDocument()
  })

  test("shows the continue button when closed and next phase exists", () => {
    renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        stillAccepting={false}
        next="collecting_bookings"
        advancePending={false}
        advanceError={null}
        onContinue={() => {}}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Continue to booking days" }),
    ).toBeInTheDocument()
  })

  test("invokes onContinue when the button is clicked", async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        stillAccepting={false}
        next="collecting_bookings"
        advancePending={false}
        advanceError={null}
        onContinue={onContinue}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Continue to booking days" }),
    )
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  test("renders advance error message when provided", () => {
    renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        stillAccepting={false}
        next="collecting_bookings"
        advancePending={false}
        advanceError={{ message: "boom" }}
        onContinue={() => {}}
      />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("boom")
  })
})
