import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { AddMemberForm } from "./AddMemberForm"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
]

describe("AddMemberForm", () => {
  test("renders user options and action buttons", () => {
    render(
      <AddMemberForm
        groupName="Owners"
        availableUsers={users}
        pending={false}
        onSubmit={() => {}}
        onSwitchToCreateUser={() => {}}
        onCancel={() => {}}
      />,
    )
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
    render(
      <AddMemberForm
        groupName="Owners"
        availableUsers={users}
        pending={false}
        onSubmit={onSubmit}
        onSwitchToCreateUser={() => {}}
        onCancel={() => {}}
      />,
    )

    await user.selectOptions(screen.getByLabelText("User"), "2")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toBe(2)
    expect(typeof onSubmit.mock.calls[0][1]).toBe("function")
  })

  test("selecting the +Add user sentinel calls onSwitchToCreateUser and does not submit", async () => {
    const onSubmit = vi.fn()
    const onSwitchToCreateUser = vi.fn()
    const user = userEvent.setup()
    render(
      <AddMemberForm
        groupName="Owners"
        availableUsers={users}
        pending={false}
        onSubmit={onSubmit}
        onSwitchToCreateUser={onSwitchToCreateUser}
        onCancel={() => {}}
      />,
    )

    await user.selectOptions(screen.getByLabelText("User"), "+ Add user")
    expect(onSwitchToCreateUser).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("Save button is disabled when no users are available", () => {
    render(
      <AddMemberForm
        groupName="Owners"
        availableUsers={[]}
        pending={false}
        onSubmit={() => {}}
        onSwitchToCreateUser={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  test("both buttons are disabled while pending", () => {
    render(
      <AddMemberForm
        groupName="Owners"
        availableUsers={users}
        pending={true}
        onSubmit={() => {}}
        onSwitchToCreateUser={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })

  test("Cancel button calls onCancel", async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <AddMemberForm
        groupName="Owners"
        availableUsers={users}
        pending={false}
        onSubmit={() => {}}
        onSwitchToCreateUser={() => {}}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
