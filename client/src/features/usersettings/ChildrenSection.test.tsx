import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { ChildrenSection } from "./ChildrenSection"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars
        ? key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
        : key,
  }),
}))

vi.mock("@/trpc/trpc", () => ({
  useTRPC: () => ({
    user: {
      listMyChildren: {
        queryKey: () => ["user", "listMyChildren"],
        queryOptions: () => ({ queryKey: ["user", "listMyChildren"] }),
      },
      listLinkableParents: {
        queryKey: () => ["user", "listLinkableParents"],
        queryOptions: () => ({ queryKey: ["user", "listLinkableParents"] }),
      },
      createChild: { mutationOptions: (opts: unknown) => opts },
      updateChild: { mutationOptions: (opts: unknown) => opts },
      removeChild: { mutationOptions: (opts: unknown) => opts },
      addParent: { mutationOptions: (opts: unknown) => opts },
      removeParent: { mutationOptions: (opts: unknown) => opts },
    },
  }),
}))

type MutationStub = {
  mutate: ReturnType<typeof vi.fn>
  state: { isPending: boolean; error: { message: string } | null }
}

type Parent = { id: number; name: string; isCreator: boolean }
type Child = { id: number; name: string; parents: Parent[] }

let childrenData: Child[] | undefined
let linkableData: { id: number; name: string }[] | undefined
// Mutation stubs in the order the component calls useMutation.
let createStub: MutationStub
let updateStub: MutationStub
let removeStub: MutationStub
let addParentStub: MutationStub
let removeParentStub: MutationStub
let mutationCallIndex = 0

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (opts: { queryKey: string[] }) => {
    if (opts.queryKey[1] === "listLinkableParents") {
      return { data: linkableData }
    }
    // listMyChildren runs before the useMutation calls — reset the index here.
    mutationCallIndex = 0
    return { data: childrenData }
  },
  useMutation: (opts: Record<string, unknown>) => {
    const stubs = [
      createStub,
      updateStub,
      removeStub,
      addParentStub,
      removeParentStub,
    ]
    const stub = stubs[mutationCallIndex++ % stubs.length]
    return {
      mutate: stub.mutate,
      mutateAsync: stub.mutate,
      isPending: stub.state.isPending,
      error: stub.state.error,
      _opts: opts,
    }
  },
}))

const freshStub = (): MutationStub => ({
  mutate: vi.fn(),
  state: { isPending: false, error: null },
})

const child = (
  id: number,
  name: string,
  parents: Parent[] = [{ id: 100, name: "Me", isCreator: true }],
): Child => ({ id, name, parents })

beforeEach(() => {
  childrenData = []
  linkableData = []
  createStub = freshStub()
  updateStub = freshStub()
  removeStub = freshStub()
  addParentStub = freshStub()
  removeParentStub = freshStub()
  mutationCallIndex = 0
})

describe("ChildrenSection", () => {
  test("shows empty-state message when there are no children", () => {
    render(<ChildrenSection />)
    expect(screen.getByText("No children yet.")).toBeInTheDocument()
  })

  test("renders a list when children exist", () => {
    childrenData = [child(1, "Lila"), child(2, "Mo")]
    render(<ChildrenSection />)
    expect(screen.getByText("Lila")).toBeInTheDocument()
    expect(screen.getByText("Mo")).toBeInTheDocument()
    expect(screen.queryByText("No children yet.")).not.toBeInTheDocument()
  })

  test("submitting add-child form calls createChild with trimmed name", async () => {
    const user = userEvent.setup()
    render(<ChildrenSection />)
    const nameInput = screen.getByLabelText("Name")
    await user.type(nameInput, "  Newkid  ")
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(createStub.mutate).toHaveBeenCalledTimes(1)
    expect(createStub.mutate.mock.calls[0][0]).toEqual({ name: "Newkid" })
  })

  test("does not call createChild when name is blank", async () => {
    const user = userEvent.setup()
    render(<ChildrenSection />)
    const input = screen.getByLabelText("Name")
    input.removeAttribute("required")
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(createStub.mutate).not.toHaveBeenCalled()
  })

  test("clicking Edit reveals an editable form pre-filled with the child's name", async () => {
    childrenData = [child(5, "Pip")]
    const user = userEvent.setup()
    render(<ChildrenSection />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    const editInputs = screen.getAllByLabelText("Name")
    // First "Name" input is the edit form, second is the add-child form.
    expect(editInputs[0]).toHaveValue("Pip")
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })

  test("Cancel exits edit mode without calling updateChild", async () => {
    childrenData = [child(5, "Pip")]
    const user = userEvent.setup()
    render(<ChildrenSection />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(updateStub.mutate).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument()
  })

  test("submitting edit form calls updateChild with id and trimmed name", async () => {
    childrenData = [child(5, "Pip")]
    const user = userEvent.setup()
    render(<ChildrenSection />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    const editInput = screen.getAllByLabelText("Name")[0]
    await user.clear(editInput)
    await user.type(editInput, "  Pippa  ")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(updateStub.mutate).toHaveBeenCalledWith({ id: 5, name: "Pippa" })
  })

  test("Remove asks for confirmation and calls removeChild on confirm", async () => {
    childrenData = [child(9, "Sam")]
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const user = userEvent.setup()
    render(<ChildrenSection />)
    await user.click(screen.getByRole("button", { name: "Remove" }))
    expect(confirmSpy).toHaveBeenCalledWith("Remove Sam?")
    expect(removeStub.mutate).toHaveBeenCalledWith({ id: 9 })
    confirmSpy.mockRestore()
  })

  test("Remove does NOT call removeChild when confirmation is cancelled", async () => {
    childrenData = [child(9, "Sam")]
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    const user = userEvent.setup()
    render(<ChildrenSection />)
    await user.click(screen.getByRole("button", { name: "Remove" }))
    expect(removeStub.mutate).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  test("disables Add button while create mutation is pending", () => {
    createStub.state.isPending = true
    render(<ChildrenSection />)
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
  })

  test("renders an alert when createChild has an error", () => {
    createStub.state.error = { message: "create failed" }
    render(<ChildrenSection />)
    expect(screen.getByRole("alert")).toHaveTextContent("create failed")
  })

  test("renders an alert for update/remove errors above the add form", () => {
    childrenData = [child(1, "Lila")]
    updateStub.state.error = { message: "update failed" }
    render(<ChildrenSection />)
    expect(screen.getByRole("alert")).toHaveTextContent("update failed")
  })

  test("lists a child's parents", () => {
    childrenData = [
      child(1, "Lila", [
        { id: 100, name: "Me", isCreator: true },
        { id: 200, name: "Co-parent", isCreator: false },
      ]),
    ]
    render(<ChildrenSection />)
    expect(screen.getByText("Me")).toBeInTheDocument()
    expect(screen.getByText("Co-parent")).toBeInTheDocument()
  })

  test("offers candidates and adds a second parent", async () => {
    childrenData = [child(1, "Lila")]
    linkableData = [{ id: 200, name: "Dana" }]
    const user = userEvent.setup()
    render(<ChildrenSection />)
    await user.selectOptions(screen.getByLabelText("Add another parent"), "200")
    await user.click(screen.getByRole("button", { name: "Add parent" }))
    expect(addParentStub.mutate).toHaveBeenCalledWith({
      childId: 1,
      parentUserId: 200,
    })
  })

  test("hides the add-parent form once a child has two parents", () => {
    childrenData = [
      child(1, "Lila", [
        { id: 100, name: "Me", isCreator: true },
        { id: 200, name: "Dana", isCreator: false },
      ]),
    ]
    linkableData = [{ id: 300, name: "Eli" }]
    render(<ChildrenSection />)
    expect(
      screen.queryByLabelText("Add another parent"),
    ).not.toBeInTheDocument()
  })

  test("excludes a child's existing parents from the candidate list", () => {
    childrenData = [
      child(1, "Lila", [{ id: 100, name: "Me", isCreator: true }]),
    ]
    linkableData = [
      { id: 100, name: "Me" },
      { id: 200, name: "Dana" },
    ]
    render(<ChildrenSection />)
    const select = screen.getByLabelText("Add another parent")
    expect(screen.getByRole("option", { name: "Dana" })).toBeInTheDocument()
    // "Me" (id 100) is already a parent, so it must not be an option.
    const meOption = screen.queryByRole("option", { name: "Me" })
    expect(meOption).not.toBeInTheDocument()
    expect(select).toBeInTheDocument()
  })

  test("removeParent asks for confirmation and fires on confirm", async () => {
    childrenData = [
      child(1, "Lila", [
        { id: 100, name: "Me", isCreator: true },
        { id: 200, name: "Dana", isCreator: false },
      ]),
    ]
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const user = userEvent.setup()
    render(<ChildrenSection />)
    // Two "Remove" buttons exist: the child's, and Dana's (non-creator parent).
    const removeButtons = screen.getAllByRole("button", { name: "Remove" })
    await user.click(removeButtons[removeButtons.length - 1])
    expect(confirmSpy).toHaveBeenCalledWith("Remove Dana as a parent?")
    expect(removeParentStub.mutate).toHaveBeenCalledWith({
      childId: 1,
      parentUserId: 200,
    })
    confirmSpy.mockRestore()
  })
})
