import { describe, expect, test, vi } from "vitest"
import { render } from "@testing-library/react"

vi.mock("@navikt/aksel-icons", () => ({
  BedIcon: (props: object) => <svg data-variant="empty" {...props} />,
  BedFillIcon: (props: object) => <svg data-variant="filled" {...props} />,
}))

import { BedIconRow } from "./BedIcons.tsx"

function bedCount(container: HTMLElement) {
  return container.querySelectorAll("svg").length
}

describe("BedIconRow", () => {
  test("renders one icon per bed up to total", () => {
    const { container } = render(
      <BedIconRow total={5} existingCount={0} draftCount={0} />,
    )
    expect(bedCount(container)).toBe(5)
  })

  test("shows overflow badge when total exceeds MAX_BED_ICONS", () => {
    const { container, getByText } = render(
      <BedIconRow total={15} existingCount={0} draftCount={0} />,
    )
    expect(bedCount(container)).toBe(12)
    expect(getByText("+3")).toBeInTheDocument()
  })

  test("adds 'over' icons when placed > total", () => {
    const { container } = render(
      <BedIconRow total={4} existingCount={2} draftCount={4} />,
    )
    // 4 slots + 2 over icons = 6 svgs
    expect(bedCount(container)).toBe(6)
  })

  test("no overflow badge when total fits within MAX_BED_ICONS", () => {
    const { container } = render(
      <BedIconRow total={6} existingCount={0} draftCount={0} />,
    )
    expect(container.textContent).not.toMatch(/\+\d+/)
  })
})
