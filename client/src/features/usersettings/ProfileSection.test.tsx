import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { ProfileSection } from "./ProfileSection"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "") : key,
  }),
}))

const nameMutate = vi.fn()
const birthdayMutate = vi.fn()
const isHeadMutate = vi.fn()
const nameState = { isPending: false, error: null as { message: string } | null }
const birthdayState = { isPending: false, error: null as { message: string } | null }
const isHeadState = { isPending: false, error: null as { message: string } | null }

vi.mock("@/trpc/trpc", () => ({
  useTRPC: () => ({
    user: {
      me: { queryKey: () => ["user", "me"] },
      updateMyName: { mutationOptions: (opts: unknown) => opts },
      updateMyBirthday: { mutationOptions: (opts: unknown) => opts },
      updateMyIsHead: { mutationOptions: (opts: unknown) => opts },
    },
  }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (opts: { mutationFn?: unknown } & Record<string, unknown>) => {
    // Pick the right mutate fn based on which mutation option object came through.
    // We piggyback on the captured mutate spies in test setup via a counter.
    const fn: MutationStub = mutationDispatcher.shift() ?? {
      mutate: vi.fn(),
      state: { isPending: false, error: null },
    }
    return {
      mutate: fn.mutate,
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

// Mutation hooks are called in source order: name, birthday, isHead.
let mutationDispatcher: MutationStub[] = []

const me = {
  id: 1,
  name: "Alice",
  birthday: "1990-05-12",
  is_head: false,
}

beforeEach(() => {
  nameMutate.mockReset()
  birthdayMutate.mockReset()
  isHeadMutate.mockReset()
  nameState.isPending = false
  nameState.error = null
  birthdayState.isPending = false
  birthdayState.error = null
  isHeadState.isPending = false
  isHeadState.error = null
  mutationDispatcher = [
    { mutate: nameMutate, state: nameState },
    { mutate: birthdayMutate, state: birthdayState },
    { mutate: isHeadMutate, state: isHeadState },
  ]
})

describe("ProfileSection", () => {
  test("renders name, birthday and head-of-household fields", () => {
    render(<ProfileSection me={me} />)
    expect(screen.getByLabelText("Name")).toHaveValue("Alice")
    expect(screen.getByLabelText("Birthday")).toHaveValue("1990-05-12")
    expect(
      screen.getByLabelText(
        "I am a household head (can be assigned a priority week and settlement)",
      ),
    ).not.toBeChecked()
  })

  test("reflects is_head=true in the checkbox", () => {
    render(<ProfileSection me={{ ...me, is_head: true }} />)
    expect(
      screen.getByLabelText(
        "I am a household head (can be assigned a priority week and settlement)",
      ),
    ).toBeChecked()
  })

  test("renders empty birthday when null", () => {
    render(<ProfileSection me={{ ...me, birthday: null }} />)
    expect(screen.getByLabelText("Birthday")).toHaveValue("")
  })

  test("does not call updateName when name is unchanged", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[0]!)
    expect(nameMutate).not.toHaveBeenCalled()
  })

  test("calls updateName with trimmed value when name changes", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const nameInput = screen.getByLabelText("Name")
    await user.clear(nameInput)
    await user.type(nameInput, "  Bob  ")
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[0]!)
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
    await user.click(saveButtons[0]!)
    expect(nameMutate).not.toHaveBeenCalled()
  })

  test("calls updateBirthday with null when birthday cleared", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const birthdayInput = screen.getByLabelText("Birthday")
    await user.clear(birthdayInput)
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[1]!)
    expect(birthdayMutate).toHaveBeenCalledWith({ birthday: null })
  })

  test("does not call updateBirthday when value unchanged", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    const saveButtons = screen.getAllByRole("button", { name: "Save" })
    await user.click(saveButtons[1]!)
    expect(birthdayMutate).not.toHaveBeenCalled()
  })

  test("toggling head checkbox calls updateIsHead with new value", async () => {
    const user = userEvent.setup()
    render(<ProfileSection me={me} />)
    await user.click(
      screen.getByLabelText(
        "I am a household head (can be assigned a priority week and settlement)",
      ),
    )
    expect(isHeadMutate).toHaveBeenCalledWith({ is_head: true })
  })

  test("disables the name save button while pending", () => {
    nameState.isPending = true
    render(<ProfileSection me={me} />)
    expect(screen.getAllByRole("button", { name: "Save" })[0]).toBeDisabled()
  })

  test("renders an alert when updateName has an error", () => {
    nameState.error = { message: "name oops" }
    render(<ProfileSection me={me} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Error: name oops")
  })
})
