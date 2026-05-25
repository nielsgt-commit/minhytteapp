import { describe, expect, test } from "vitest"
import { render } from "@testing-library/react"
import { WheelbarrowFillIcon, WheelbarrowIcon } from "./WheelbarrowIcon"

describe("WheelbarrowIcon", () => {
  test("renders an svg with role img", () => {
    const { getByRole } = render(<WheelbarrowIcon />)
    expect(getByRole("img")).toBeInTheDocument()
  })

  test("renders a <title> child when title prop provided", () => {
    const { container } = render(<WheelbarrowIcon title="hauling" />)
    expect(container.querySelector("title")?.textContent).toBe("hauling")
  })

  test("omits <title> when no title prop", () => {
    const { container } = render(<WheelbarrowIcon />)
    expect(container.querySelector("title")).toBeNull()
  })

  test("fill variant uses currentColor fill on body path", () => {
    const { container } = render(<WheelbarrowFillIcon />)
    const filled = container.querySelectorAll('path[fill="currentColor"]')
    expect(filled.length).toBeGreaterThan(0)
  })
})
