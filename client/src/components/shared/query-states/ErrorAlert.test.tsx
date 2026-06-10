import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { ErrorAlert } from "./ErrorAlert"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("ErrorAlert", () => {
  test("renders nothing when error is null", () => {
    const { container } = render(<ErrorAlert error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  test("renders an alert with the generic title and the error message", () => {
    render(<ErrorAlert error={{ message: "boom" }} />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(alert).toHaveTextContent("boom")
  })

  test("uses the danger color", () => {
    render(<ErrorAlert error={{ message: "boom" }} />)
    expect(screen.getByRole("alert")).toHaveAttribute("data-color", "danger")
  })
})
