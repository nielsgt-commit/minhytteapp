import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SettlementPhaseStepper } from "./SettlementPhaseStepper"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("SettlementPhaseStepper", () => {
  test("renders nav with the localized aria-label", () => {
    render(<SettlementPhaseStepper phase="collecting_expenses" />)
    expect(
      screen.getByRole("navigation", { name: "Settlement phases" }),
    ).toBeInTheDocument()
  })

  test("renders one step per SETTLEMENT_PHASES entry, numbered 1..5", () => {
    const { container } = render(<SettlementPhaseStepper phase="reviewing" />)
    expect(
      container.querySelectorAll("[aria-current], div > span + span").length,
    ).toBeGreaterThan(0)
    for (const n of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByText(n)).toBeInTheDocument()
    }
  })

  test("marks the active phase with aria-current='step'", () => {
    const { container } = render(<SettlementPhaseStepper phase="reviewing" />)
    const active = container.querySelectorAll("[aria-current='step']")
    expect(active).toHaveLength(1)
    expect(active[0].textContent).toContain("Reviewing")
  })

  test("does not mark other phases as current", () => {
    const { container } = render(<SettlementPhaseStepper phase="closed" />)
    expect(container.querySelectorAll("[aria-current='step']")).toHaveLength(1)
  })
})
