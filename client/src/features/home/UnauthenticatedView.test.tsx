import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { UnauthenticatedView } from "./UnauthenticatedView"

const magicLinkMock = vi.fn()

vi.mock("@/auth/auth-client", () => ({
  signIn: {
    magicLink: (...args: unknown[]) => magicLinkMock(...args),
  },
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({
    i18nKey,
    values,
  }: {
    i18nKey: string
    values?: Record<string, unknown>
  }) => (
    <span>
      {values?.email ? `${i18nKey} ${String(values.email)}` : i18nKey}
    </span>
  ),
}))

beforeEach(() => {
  magicLinkMock.mockReset()
})

describe("UnauthenticatedView", () => {
  test("renders the sign-in form", () => {
    render(<UnauthenticatedView />)
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Send magic link" }),
    ).toBeInTheDocument()
  })

  test("submit button is disabled when email is empty", () => {
    render(<UnauthenticatedView />)
    expect(
      screen.getByRole("button", { name: "Send magic link" }),
    ).toBeDisabled()
  })

  test("submit button becomes enabled after typing an email", async () => {
    const user = userEvent.setup()
    render(<UnauthenticatedView />)
    await user.type(screen.getByPlaceholderText("you@example.com"), "a@b.com")
    expect(
      screen.getByRole("button", { name: "Send magic link" }),
    ).toBeEnabled()
  })

  test("calls signIn.magicLink with email and callbackURL on submit", async () => {
    magicLinkMock.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(<UnauthenticatedView />)
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "user@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Send magic link" }))

    expect(magicLinkMock).toHaveBeenCalledTimes(1)
    expect(magicLinkMock).toHaveBeenCalledWith({
      email: "user@example.com",
      callbackURL: "/oversikt",
    })
  })

  test("shows the 'Check your email' confirmation after a successful send", async () => {
    magicLinkMock.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(<UnauthenticatedView />)
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "user@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Send magic link" }))

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/user@example\.com/)).toBeInTheDocument()
  })

  test("renders the server error message when magicLink returns an error", async () => {
    magicLinkMock.mockResolvedValueOnce({
      error: { message: "Rate limited" },
    })
    const user = userEvent.setup()
    render(<UnauthenticatedView />)
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "user@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Send magic link" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Rate limited")
  })

  test("falls back to a generic message when the error has no message", async () => {
    magicLinkMock.mockResolvedValueOnce({ error: {} })
    const user = userEvent.setup()
    render(<UnauthenticatedView />)
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "user@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Send magic link" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not send magic link")
  })

  test("does not call magicLink when the email field is empty", async () => {
    const user = userEvent.setup()
    render(<UnauthenticatedView />)
    await user.click(screen.getByRole("button", { name: "Send magic link" }))
    expect(magicLinkMock).not.toHaveBeenCalled()
  })
})
