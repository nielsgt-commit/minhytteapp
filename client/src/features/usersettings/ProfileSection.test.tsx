import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { ProfileSection } from "./ProfileSection"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars
        ? key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
        : key,
  }),
}))

const nameMutate = vi.fn()
const birthdayMutate = vi.fn()
const headMutate = vi.fn()
const nameState = {
  isPending: false,
  error: null as { message: string } | null,
}
const birthdayState = {
  isPending: false,
  error: null as { message: string } | null,
}
const headState = {
  isPending: false,
  error: null as { message: string } | null,
}

vi.mock("@/trpc/trpc", () => ({
  useTRPC: () => ({
    user: {
      me: { queryKey: () => ["user", "me"] },
      updateMyName: { mutationOptions: (opts: unknown) => opts },
      updateMyBirthday: { mutationOptions: (opts: unknown) => opts },
      updateMyHeadForProperty: { mutationOptions: (opts: unknown) => opts },
    },
  }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (opts: { mutationFn?: unknown } & Record<string, unknown>) => {
    const fn: MutationStub = mutationDispatcher.shift() ?? {
      mutate: vi.fn(),
      state: { isPending: false, error: null },
    }
    return {
      mutate: fn.mutate,
      mutateAsync: fn.mutate,
      isPending: fn.state.isPending,
      error: fn.state.error,
      _opts: opts,
    }
  },
}))

type MutationStub = {
  mutate: ReturnType<typeof vi.fn>
  state: { isPending: boolean; error: { message: string } | null }
}

// Mutation hooks are called in source order: name, birthday, head.
let mutationDispatcher: MutationStub[] = []

const me = {
  id: 1,
  name: "Alice",
  birthday: "1990-05-12",
  my_main_memberships: [
    {
      property_id: 10,
      property_name: "Hytta",
      user_group_id: 100,
      is_head: false,
    },
  ],
}

beforeEach(() => {
  nameMutate.mockReset()
  birthdayMutate.mockReset()
  headMutate.mockReset()
  nameState.isPending = false
  nameState.error = null
  birthdayState.isPending = false
  birthdayState.error = null
  headState.isPending = false
  headState.error = null
  mutationDispatcher = [
    { mutate: nameMutate, state: nameState },
    { mutate: birthdayMutate, state: birthdayState },
    { mutate: headMutate, state: headState },
  ]
})

describe("ProfileSection", () => {
  const headLabel =
    "I am a household head for Hytta (can be assigned a priority week and settlement)"

  test("renders name, birthday and per-property head fields", () => {
    render(<ProfileSection me={me} />)
    expect(screen.getByLabelText("Name")).toHaveValue("Alice")
    expect(screen.getByLabelText("Birthday")).toHaveValue("1990-05-12")
    expect(screen.getByLabelText(headLabel)).not.toBeChecked()
  })

  test("reflects membership is_head=true in the checkbox", () => {
    render(
      <ProfileSection
        me={{
          ...me,
          my_main_memberships: [
            { ...me.my_main_memberships[0], is_head: true },
          ],
        }}
      />,
    )
    expect(screen.getByLabelText(headLabel)).toBeChecked()
  })

  test("renders a checkbox per membership", () => {
    render(
      <ProfileSection
        me={{
          ...me,
          my_main_memberships: [
            me.my_main_memberships[0],
            {
              property_id: 11,
              property_name: "Stua",
              user_group_id: 101,
              is_head: true,
            },
          ],
        }}
      />,
    )
    expect(screen.getByLabelText(headLabel)).toBeInTheDocument()
    expect(
      screen.getByLabelText(
        "I am a household head for Stua (can be assigned a priority week and settlement)",
      ),
    ).toBeInTheDocument()
  })

  test("renders a note when there are no main memberships", () => {
    render(<ProfileSection me={{ ...me, my_main_memberships: [] }} />)
    expect(
      screen.getByText("You are not in a family group yet."),
    ).toBeInTheDocument()
  })

  test("renders empty birthday when null", () => {
    render(<ProfileSection me={{ ...me, birthday: null }} />)
    expect(screen.getByLabelText("Birthday")).toHaveValue("")
  })

  test("does not call updateName when name is unchanged", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[0])
    expect(nameMutate).not.toHaveBeenCalled()
  })

  test("calls updateName with trimmed value when name changes", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const nameInput = screen.getByLabelText("Name")
    await user.clear(nameInput)
    await user.type(nameInput, "  Bob  ")
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[0])
    expect(nameMutate).toHaveBeenCalledWith({ name: "Bob" })
  })

  test("does not call updateName when trimmed name is empty", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const nameInput = screen.getByLabelText("Name")
    await user.clear(nameInput)
    // Required field — bypass by removing required attr so submission proceeds.
    nameInput.removeAttribute("required")
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[0])
    expect(nameMutate).not.toHaveBeenCalled()
  })

  test("calls updateBirthday with null when birthday cleared", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const birthdayInput = screen.getByLabelText("Birthday")
    await user.clear(birthdayInput)
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[1])
    expect(birthdayMutate).toHaveBeenCalledWith({ birthday: null })
  })

  test("does not call updateBirthday when value unchanged", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[1])
    expect(birthdayMutate).not.toHaveBeenCalled()
  })

  test("toggling head checkbox calls updateMyHeadForProperty with property_id", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    await user.click(screen.getByLabelText(headLabel))
    expect(headMutate).toHaveBeenCalledWith({
      property_id: 10,
      is_head: true,
    })
  })

  test("renders an alert when updateName has an error", () => {
    nameState.error = { message: "name oops" }
    render(<ProfileSection me={me} />)
    expect(screen.getByRole("alert")).toHaveTextContent("name oops")
  })
})
