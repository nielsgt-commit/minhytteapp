import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { GroupCard } from "./GroupCard"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const baseGroup = {
  id: 1,
  name: "Owners",
  is_family: false,
  members: [
    { user_id: 10, user_name: "Alice" },
    { user_id: 11, user_name: "Bob" },
  ],
}

const availableUsers = [
  { id: 12, name: "Carol" },
  { id: 13, name: "Dan" },
]

function makeProps(
  overrides: Partial<React.ComponentProps<typeof GroupCard>> = {},
) {
  return {
    group: baseGroup,
    availableUsers,
    availableInvites: [],
    canEdit: true,
    isRenaming: false,
    isAddingMember: false,
    isCreatingUser: false,
    pending: false,
    renamePending: false,
    addMemberPending: false,
    createUserPending: false,
    onStartRename: vi.fn(),
    onToggleAddMember: vi.fn(),
    onDelete: vi.fn(),
    onRenameSubmit: vi.fn(),
    onAddMember: vi.fn(),
    onAddInvite: vi.fn(),
    onCreateAndAddMember: vi.fn(),
    onSwitchToCreateUser: vi.fn(),
    onBackFromCreateUser: vi.fn(),
    onCancelRename: vi.fn(),
    onCancelAddMember: vi.fn(),
    onRemoveMember: vi.fn(),
    ...overrides,
  }
}

describe("GroupCard", () => {
  test("renders group name, member count, and member rows", () => {
    render(<GroupCard {...makeProps()} />)
    expect(screen.getByRole("heading", { name: /Owners/ })).toBeInTheDocument()
    expect(screen.getByText("{{count}} member")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })

  test("shows '(main)' marker when group.is_family is true", () => {
    render(
      <GroupCard {...makeProps({ group: { ...baseGroup, is_family: true } })} />,
    )
    expect(screen.getByText("(main)")).toBeInTheDocument()
  })

  test("shows 'No members yet.' when the group has no members", () => {
    render(
      <GroupCard {...makeProps({ group: { ...baseGroup, members: [] } })} />,
    )
    expect(screen.getByText("No members yet.")).toBeInTheDocument()
  })

  test("hides Edit, Delete, Add member, and Remove controls when canEdit=false", () => {
    render(<GroupCard {...makeProps({ canEdit: false })} />)
    expect(
      screen.queryByRole("button", { name: /Edit group Owners/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Delete group Owners/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add member" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Remove Alice from group/ }),
    ).not.toBeInTheDocument()
  })

  test("clicking Add member calls onToggleAddMember", async () => {
    const onToggleAddMember = vi.fn()
    const user = userEvent.setup()
    render(<GroupCard {...makeProps({ onToggleAddMember })} />)
    await user.click(screen.getByRole("button", { name: "Add member" }))
    expect(onToggleAddMember).toHaveBeenCalledTimes(1)
  })

  test("clicking Delete calls onDelete", async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<GroupCard {...makeProps({ onDelete })} />)
    await user.click(
      screen.getByRole("button", { name: "Delete group {{groupName}}" }),
    )
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  test("clicking Remove on a member calls onRemoveMember with id and name", async () => {
    const onRemoveMember = vi.fn()
    const user = userEvent.setup()
    render(<GroupCard {...makeProps({ onRemoveMember })} />)
    await user.click(
      screen.getAllByRole("button", {
        name: "Remove {{userName}} from group",
      })[0],
    )
    expect(onRemoveMember).toHaveBeenCalledTimes(1)
    expect(onRemoveMember).toHaveBeenCalledWith(10, "Alice")
  })

  test("renders the rename form when isRenaming and submits trimmed values", async () => {
    const onRenameSubmit = vi.fn()
    const user = userEvent.setup()
    render(<GroupCard {...makeProps({ isRenaming: true, onRenameSubmit })} />)

    const nameField = screen.getByLabelText("Name") as HTMLInputElement
    expect(nameField.value).toBe("Owners")

    await user.clear(nameField)
    await user.type(nameField, "  Renamed  ")
    await user.click(screen.getByLabelText("Main"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onRenameSubmit).toHaveBeenCalledTimes(1)
    expect(onRenameSubmit).toHaveBeenCalledWith({
      name: "Renamed",
      is_family: true,
    })
  })

  test("renders AddMemberForm when isAddingMember and not isCreatingUser", () => {
    render(<GroupCard {...makeProps({ isAddingMember: true })} />)
    // The legend includes the group name interpolated via the mocked t key.
    expect(screen.getByLabelText("User")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Carol" })).toBeInTheDocument()
  })

  test("renders CreateUserForm when isAddingMember and isCreatingUser", () => {
    render(
      <GroupCard
        {...makeProps({ isAddingMember: true, isCreatingUser: true })}
      />,
    )
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument()
    // AddMemberForm should not also be rendered.
    expect(screen.queryByLabelText("User")).not.toBeInTheDocument()
  })

  test("disables Add member and Remove buttons while pending", () => {
    render(<GroupCard {...makeProps({ pending: true })} />)
    expect(screen.getByRole("button", { name: "Add member" })).toBeDisabled()
    const removes = screen.getAllByRole("button", {
      name: "Remove {{userName}} from group",
    })
    for (const btn of removes) expect(btn).toBeDisabled()
  })
})
