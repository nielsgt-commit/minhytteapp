import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { SubmitRow } from "./SubmitRow.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("SubmitRow", () => {
  test("renders Submit and Cancel buttons", () => {
    render(<SubmitRow pending={false} onCancel={() => {}} />)
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })

  test("Submit is type=submit and Cancel is type=button", () => {
    render(<SubmitRow pending={false} onCancel={() => {}} />)
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute(
      "type",
      "submit",
    )
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "type",
      "button",
    )
  })

  test("Cancel fires the callback", async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<SubmitRow pending={false} onCancel={onCancel} />)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("both buttons are disabled while pending", () => {
    render(<SubmitRow pending={true} onCancel={() => {}} />)
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })
})
