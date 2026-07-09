import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { ReviewHeader } from "./ReviewHeader.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("ReviewHeader", () => {
  test("renders the step heading with its number", () => {
    render(<ReviewHeader />)
    expect(
      screen.getByRole("heading", { name: "1 Review expenses" }),
    ).toBeInTheDocument()
  })

  test("renders the review explainer paragraph", () => {
    render(<ReviewHeader />)
    expect(
      screen.getByText(/This is where you review the expenses/),
    ).toBeInTheDocument()
  })
})
