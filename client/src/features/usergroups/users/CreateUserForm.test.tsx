import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { CreateUserForm } from "./CreateUserForm"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("CreateUserForm", () => {
  test("renders the name field and Save/Back buttons", () => {
    render(
      <CreateUserForm
        groupName="Owners"
        pending={false}
        onSubmit={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument()
  })

  test("submits the typed name and provides a reset callback", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateUserForm
        groupName="Owners"
        pending={false}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    )

    await user.type(screen.getByLabelText("Name"), "Carol")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toBe("Carol")
    expect(typeof onSubmit.mock.calls[0][1]).toBe("function")
  })

  test("trims surrounding whitespace from the submitted name", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateUserForm
        groupName="Owners"
        pending={false}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    )

    await user.type(screen.getByLabelText("Name"), "  Dan  ")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit.mock.calls[0][0]).toBe("Dan")
  })

  test("does not submit when name is only whitespace", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateUserForm
        groupName="Owners"
        pending={false}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    )

    await user.type(screen.getByLabelText("Name"), "    ")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("Back button calls onBack and does not submit", async () => {
    const onSubmit = vi.fn()
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateUserForm
        groupName="Owners"
        pending={false}
        onSubmit={onSubmit}
        onBack={onBack}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("disables both buttons while pending", () => {
    render(
      <CreateUserForm
        groupName="Owners"
        pending={true}
        onSubmit={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled()
  })

  test("invoking the reset callback clears the input", async () => {
    const user = userEvent.setup()
    let capturedReset: () => void = () => {}
    const onSubmit = vi.fn((_name, reset: () => void) => {
      capturedReset = reset
    })
    render(
      <CreateUserForm
        groupName="Owners"
        pending={false}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    )

    const field = screen.getByLabelText("Name") as HTMLInputElement
    await user.type(field, "Eve")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(field.value).toBe("Eve")
    capturedReset()
    expect(field.value).toBe("")
  })
})
