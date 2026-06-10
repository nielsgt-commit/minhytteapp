import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { EmptyState } from "./EmptyState"

describe("EmptyState", () => {
  test("renders the title as a paragraph", () => {
    render(<EmptyState title="No contacts." />)
    expect(screen.getByText("No contacts.")).toBeInTheDocument()
  })

  test("renders children after the title", () => {
    render(
      <EmptyState title="Nothing here">
        <button type="button">Add one</button>
      </EmptyState>,
    )
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add one" })).toBeInTheDocument()
  })
})
