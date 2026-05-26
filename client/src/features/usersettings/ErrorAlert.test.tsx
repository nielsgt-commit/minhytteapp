import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { ErrorAlert } from "./ErrorAlert"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars
        ? key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
        : key,
  }),
}))

describe("ErrorAlert", () => {
  test("renders nothing when error is null", () => {
    const { container } = render(<ErrorAlert error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  test("renders nothing when error is undefined", () => {
    const { container } = render(<ErrorAlert error={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  test("renders an alert role with the error message", () => {
    render(<ErrorAlert error={{ message: "boom" }} />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Error: boom")
  })

  test("interpolates the message into the i18n template", () => {
    render(<ErrorAlert error={{ message: "Name too short" }} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Error: Name too short")
  })

  test("renders an empty message without crashing", () => {
    render(<ErrorAlert error={{ message: "" }} />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
})
