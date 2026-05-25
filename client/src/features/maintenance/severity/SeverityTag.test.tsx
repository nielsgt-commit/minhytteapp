import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { SeverityTag, cycleSeverity, type Severity } from "./SeverityTag.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}))

describe("cycleSeverity", () => {
  test("patch cycles to minor", () => {
    expect(cycleSeverity("patch")).toBe("minor")
  })

  test("minor cycles to major", () => {
    expect(cycleSeverity("minor")).toBe("major")
  })

  test("major wraps back to patch", () => {
    expect(cycleSeverity("major")).toBe("patch")
  })

  test("three applications return to the starting value", () => {
    const start: Severity = "patch"
    expect(cycleSeverity(cycleSeverity(cycleSeverity(start)))).toBe(start)
  })

  test("each severity maps to a different next severity", () => {
    const nexts = new Set<Severity>([
      cycleSeverity("patch"),
      cycleSeverity("minor"),
      cycleSeverity("major"),
    ])
    expect(nexts.size).toBe(3)
  })
})

describe("SeverityTag", () => {
  test("renders the translated severity label", () => {
    render(<SeverityTag severity="major" />)
    expect(screen.getByText("Major")).toBeInTheDocument()
  })

  test("is not interactive when onCycle is omitted", () => {
    render(<SeverityTag severity="minor" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  test("renders as a button when onCycle is provided", () => {
    render(<SeverityTag severity="minor" onCycle={() => {}} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  test("calls onCycle when clicked", async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    render(<SeverityTag severity="patch" onCycle={onCycle} />)
    await user.click(screen.getByRole("button"))
    expect(onCycle).toHaveBeenCalledTimes(1)
  })

  test("calls onCycle on Enter keydown", async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    render(<SeverityTag severity="patch" onCycle={onCycle} />)
    screen.getByRole("button").focus()
    await user.keyboard("{Enter}")
    expect(onCycle).toHaveBeenCalledTimes(1)
  })

  test("calls onCycle on Space keydown", async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    render(<SeverityTag severity="patch" onCycle={onCycle} />)
    screen.getByRole("button").focus()
    await user.keyboard(" ")
    expect(onCycle).toHaveBeenCalledTimes(1)
  })

  test("is not interactive when disabled even with onCycle provided", async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    render(<SeverityTag severity="patch" onCycle={onCycle} disabled />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    await user.click(screen.getByText("Patch"))
    expect(onCycle).not.toHaveBeenCalled()
  })
})
