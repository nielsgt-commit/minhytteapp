import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { ReviewHeader } from "./ReviewHeader.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("ReviewHeader", () => {
  test("renders the heading and toggle in accepting state", () => {
    render(
      <ReviewHeader
        stillAccepting={true}
        disabled={false}
        warningCount={null}
        onSwitchChange={() => {}}
      />,
    )
    expect(screen.getByText("Review expenses")).toBeInTheDocument()
    expect(screen.getByRole("switch")).toBeChecked()
  })

  test("hides the warning paragraph when warningCount is null", () => {
    render(
      <ReviewHeader
        stillAccepting={true}
        disabled={false}
        warningCount={null}
        onSwitchChange={() => {}}
      />,
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("shows a warning when warningCount is set", () => {
    render(
      <ReviewHeader
        stillAccepting={true}
        disabled={false}
        warningCount={3}
        onSwitchChange={() => {}}
      />,
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  test("calls onSwitchChange with the new checked value", async () => {
    const onSwitchChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ReviewHeader
        stillAccepting={true}
        disabled={false}
        warningCount={null}
        onSwitchChange={onSwitchChange}
      />,
    )
    await user.click(screen.getByRole("switch"))
    expect(onSwitchChange).toHaveBeenCalledWith(false)
  })

  test("disables the switch when disabled is true", () => {
    render(
      <ReviewHeader
        stillAccepting={true}
        disabled={true}
        warningCount={null}
        onSwitchChange={() => {}}
      />,
    )
    expect(screen.getByRole("switch")).toBeDisabled()
  })
})
