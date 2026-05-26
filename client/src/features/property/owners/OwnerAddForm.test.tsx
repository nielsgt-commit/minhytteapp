import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { OwnerAddForm } from "./OwnerAddForm.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars
        ? key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""))
        : key,
  }),
}))

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
]
const groups = [{ id: 5, name: "Family", members: [{}, {}] }]

const defaults = {
  pending: false,
  addDisabled: false,
  availableUsers: users,
  availableGroups: groups,
  totalGroups: 1,
  onKindChange: () => {},
  onSubmit: async (_fd: FormData) => {},
  onCancel: () => {},
}

describe("OwnerAddForm", () => {
  test("shows the user select with all available users when addKind is 'user'", () => {
    render(<OwnerAddForm {...defaults} addKind="user" />)
    const select = screen.getByRole("combobox")
    expect(select).toHaveAttribute("name", "user_id")
    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Bob" })).toBeInTheDocument()
  })

  test("switches to the group select when addKind is 'group'", () => {
    render(<OwnerAddForm {...defaults} addKind="group" />)
    const select = screen.getByRole("combobox")
    expect(select).toHaveAttribute("name", "user_group_id")
    expect(
      screen.getByRole("option", { name: "Family (2 members)" }),
    ).toBeInTheDocument()
  })

  test("clicking the Group chip fires onKindChange('group')", async () => {
    const onKindChange = vi.fn()
    const user = userEvent.setup()
    render(
      <OwnerAddForm {...defaults} addKind="user" onKindChange={onKindChange} />,
    )
    await user.click(screen.getByRole("radio", { name: "Group" }))
    expect(onKindChange).toHaveBeenCalledWith("group")
  })

  test("shows an empty-state message when no users are available", () => {
    render(<OwnerAddForm {...defaults} addKind="user" availableUsers={[]} />)
    expect(
      screen.getByText("All users are already owners."),
    ).toBeInTheDocument()
  })

  test("shows 'create a group' hint when no groups exist at all", () => {
    render(
      <OwnerAddForm
        {...defaults}
        addKind="group"
        availableGroups={[]}
        totalGroups={0}
      />,
    )
    expect(
      screen.getByText(/Create one from Manage user groups/),
    ).toBeInTheDocument()
  })

  test("Cancel button calls onCancel", async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<OwnerAddForm {...defaults} addKind="user" onCancel={onCancel} />)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("submit button is disabled when addDisabled is true", () => {
    render(<OwnerAddForm {...defaults} addKind="user" addDisabled={true} />)
    expect(screen.getByRole("button", { name: "Add owner" })).toBeDisabled()
  })
})
