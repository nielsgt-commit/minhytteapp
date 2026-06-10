import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { CardSkeleton } from "./CardSkeleton"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("CardSkeleton", () => {
  test("renders a busy region with a loading label", () => {
    render(<CardSkeleton />)
    const region = screen.getByLabelText("Loading")
    expect(region).toHaveAttribute("aria-busy", "true")
  })

  test("renders a title line plus the default 3 body lines", () => {
    render(<CardSkeleton />)
    expect(screen.getByLabelText("Loading").childElementCount).toBe(4)
  })

  test("respects the lines prop", () => {
    render(<CardSkeleton lines={1} />)
    expect(screen.getByLabelText("Loading").childElementCount).toBe(2)
  })
})
