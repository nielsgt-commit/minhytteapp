import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { CreateGroupForm } from "./CreateGroupForm"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("CreateGroupForm", () => {
  test("renders name field, main checkbox, and action buttons", () => {
    render(
      <CreateGroupForm
        pending={false}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByLabelText("Main")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })

  test("submits name and is_family=false by default", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateGroupForm
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )

    await user.type(screen.getByLabelText("Name"), "Owners")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ name: "Owners", is_family: false })
  })

  test("submits is_family=true when checkbox is ticked and trims the name", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateGroupForm
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )

    await user.type(screen.getByLabelText("Name"), "  Family  ")
    await user.click(screen.getByLabelText("Main"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledWith({ name: "Family", is_family: true })
  })

  test("does not call onSubmit when name is only whitespace", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateGroupForm
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )

    // The required attribute would normally stop empty submit, but the
    // component also guards against whitespace-only names explicitly.
    await user.type(screen.getByLabelText("Name"), "   ")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("Cancel button calls onCancel without submitting", async () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <CreateGroupForm
        pending={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("disables both buttons while pending", () => {
    render(
      <CreateGroupForm
        pending={true}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })

  test("the form clears after a successful submit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <CreateGroupForm
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )

    const nameField = screen.getByLabelText("Name")
    await user.type(nameField, "Temp")
    await user.click(screen.getByRole("button", { name: "Save" }))

    // React form actions reset uncontrolled fields once the action completes.
    await waitFor(() => {
      expect(nameField).toHaveValue("")
    })
  })
})
