import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import StatCard from "./StatCard"

describe("StatCard", () => {
  test("renders title, count badge, content, and footer", () => {
    const { container } = render(
      <StatCard
        title="Rooms"
        count={7}
        content={<p>body-text</p>}
        footer={<button type="button">go</button>}
      />,
    )
    expect(screen.getByText("Rooms")).toBeInTheDocument()
    expect(container.querySelector('[data-count="7"]')).not.toBeNull()
    expect(screen.getByText("body-text")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "go" })).toBeInTheDocument()
  })

  test("renders zero count", () => {
    const { container } = render(
      <StatCard
        title="Empty"
        count={0}
        content={<p>none</p>}
        footer={<span>foot</span>}
      />,
    )
    expect(container.querySelector('[data-count="0"]')).not.toBeNull()
    expect(screen.getByText("Empty")).toBeInTheDocument()
  })
})
