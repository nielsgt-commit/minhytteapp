import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { HomeLayout } from "./HomeLayout"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("HomeLayout", () => {
  test("renders the 'Home' heading", () => {
    render(
      <HomeLayout>
        <p>child</p>
      </HomeLayout>,
    )
    expect(
      screen.getByRole("heading", { name: "Home", level: 1 }),
    ).toBeInTheDocument()
  })

  test("renders its children inside the content slot", () => {
    render(
      <HomeLayout>
        <p data-testid="kid">hello</p>
      </HomeLayout>,
    )
    expect(screen.getByTestId("kid")).toHaveTextContent("hello")
  })

  test("renders multiple children", () => {
    render(
      <HomeLayout>
        <span>one</span>
        <span>two</span>
      </HomeLayout>,
    )
    expect(screen.getByText("one")).toBeInTheDocument()
    expect(screen.getByText("two")).toBeInTheDocument()
  })
})
