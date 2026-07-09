import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test-utils/renderWithProviders.tsx"
import { EmptyReviewState } from "./EmptyReviewState.tsx"

// jsdom does not implement <dialog> methods; stub them so the confirm dialog's
// content becomes visible/hidden the way the browser would show it.
beforeAll(() => {
  HTMLDialogElement.prototype.show = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event("close"))
  })
})

describe("EmptyReviewState", () => {
  test("shows '(nothing to review)' for phases other than collecting_expenses", async () => {
    await renderWithProviders(
      <EmptyReviewState
        phase="reviewing"
        next={null}
        advancePending={false}
        advanceError={null}
        onContinue={() => {}}
      />,
    )
    expect(screen.getByText("(nothing to review)")).toBeInTheDocument()
  })

  test("hides the continue button when there is no next phase", async () => {
    await renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        next={null}
        advancePending={false}
        advanceError={null}
        onContinue={() => {}}
      />,
    )
    expect(
      screen.queryByRole("button", { name: "Continue to booking days" }),
    ).not.toBeInTheDocument()
  })

  test("shows the continue button when a next phase exists", async () => {
    await renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
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

  test("asks for confirmation before invoking onContinue", async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    await renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        next="collecting_bookings"
        advancePending={false}
        advanceError={null}
        onContinue={onContinue}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Continue to booking days" }),
    )
    expect(onContinue).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole("button", { name: "Close expenses and continue" }),
    )
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  test("cancel returns to the continue button without advancing", async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    await renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        next="collecting_bookings"
        advancePending={false}
        advanceError={null}
        onContinue={onContinue}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Continue to booking days" }),
    )
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onContinue).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Continue to booking days" }),
    ).toBeInTheDocument()
  })

  test("renders advance error message when provided", async () => {
    await renderWithProviders(
      <EmptyReviewState
        phase="collecting_expenses"
        next="collecting_bookings"
        advancePending={false}
        advanceError={{ message: "boom" }}
        onContinue={() => {}}
      />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("boom")
  })
})
