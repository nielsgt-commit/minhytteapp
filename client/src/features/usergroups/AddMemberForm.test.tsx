import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { AddMemberForm } from "./AddMemberForm"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? key.replace(/{{(\w+)}}/g, (_, k: string) => String(vars[k])) : key,
  }),
}))

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
]

type Props = React.ComponentProps<typeof AddMemberForm>
const baseProps: Props = {
  groupName: "Owners",
  availableUsers: users,
  availableInvites: [],
  pending: false,
  onSubmit: async () => {},
  onAddInvite: async () => {},
  onSwitchToCreateUser: () => {},
  onCancel: () => {},
}
const renderForm = (overrides: Partial<Props> = {}) =>
  render(<AddMemberForm {...baseProps} {...overrides} />)

describe("AddMemberForm", () => {
  test("renders user options and action buttons", () => {
    renderForm()
    expect(screen.getByLabelText("User")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Bob" })).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "+ Add user" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })

  test("submits the selected user id as a number", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderForm({ onSubmit })

    await user.selectOptions(screen.getByLabelText("User"), "2")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(2)
  })

  test("renders pending invites and submits the invite id", async () => {
    const onAddInvite = vi.fn()
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderForm({
      onAddInvite,
      onSubmit,
      availableInvites: [{ id: 7, email: "mari@example.com" }],
    })

    const option = screen.getByRole("option", {
      name: "mari@example.com (invited)",
    })
    expect(option).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText("User"), option)
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onAddInvite).toHaveBeenCalledTimes(1)
    expect(onAddInvite).toHaveBeenCalledWith(7)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("selecting the +Add user sentinel calls onSwitchToCreateUser and does not submit", async () => {
    const onSubmit = vi.fn()
    const onSwitchToCreateUser = vi.fn()
    const user = userEvent.setup()
    renderForm({ onSubmit, onSwitchToCreateUser })

    await user.selectOptions(screen.getByLabelText("User"), "+ Add user")
    expect(onSwitchToCreateUser).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("Save button is disabled when no users or invites are available", () => {
    renderForm({ availableUsers: [], availableInvites: [] })
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  test("both buttons are disabled while pending", () => {
    renderForm({ pending: true })
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })

  test("Cancel button calls onCancel", async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    renderForm({ onCancel })
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
