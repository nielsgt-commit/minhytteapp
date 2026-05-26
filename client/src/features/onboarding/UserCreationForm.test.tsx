import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { UserCreationForm } from "./UserCreationForm"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("UserCreationForm", () => {
  test("renders all required fields and the submit button", () => {
    render(<UserCreationForm onSubmit={async () => {}} />)
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Is child")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Create admin" }),
    ).toBeInTheDocument()
  })

  test("submits string values and is_child=false by default", async () => {
    const onSubmit = vi.fn<(input: { name: string; email: string; is_child: boolean }) => Promise<void>>()
      .mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<UserCreationForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText("Name"), "Alice")
    await user.type(screen.getByLabelText("Email"), "alice@example.com")
    await user.click(screen.getByRole("button", { name: "Create admin" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Alice",
      email: "alice@example.com",
      is_child: false,
    })
  })

  test("submits is_child=true when the checkbox is ticked", async () => {
    const onSubmit = vi.fn<(input: { name: string; email: string; is_child: boolean }) => Promise<void>>()
      .mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<UserCreationForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText("Name"), "Kid")
    await user.type(screen.getByLabelText("Email"), "kid@example.com")
    await user.click(screen.getByLabelText("Is child"))
    await user.click(screen.getByRole("button", { name: "Create admin" }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Kid",
      email: "kid@example.com",
      is_child: true,
    })
  })

  test("does not call onSubmit when required fields are empty", async () => {
    const onSubmit = vi.fn<(input: { name: string; email: string; is_child: boolean }) => Promise<void>>()
      .mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<UserCreationForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole("button", { name: "Create admin" }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("email field has type=email for browser-level validation", () => {
    render(<UserCreationForm onSubmit={async () => {}} />)
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email")
  })
})
