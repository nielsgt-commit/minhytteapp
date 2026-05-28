import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { Home } from "./Home"

vi.mock("@/auth/auth-client", () => ({
  signIn: { magicLink: vi.fn() },
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}))

describe("Home", () => {
  test("exposes the sign-in form to the user", () => {
    render(<Home />)
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Send magic link" }),
    ).toBeInTheDocument()
  })
})
