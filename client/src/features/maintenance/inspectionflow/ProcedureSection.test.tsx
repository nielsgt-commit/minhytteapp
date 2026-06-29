import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import {
  ProcedureSection,
  type NewStep,
  type ProcedureItem,
  type ProcedureState,
} from "./ProcedureSection.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const items: ProcedureItem[] = [
  { id: 1, description: "Check smoke alarm" },
  { id: 2, description: "Test water valve" },
]

function setup(opts?: {
  state?: Record<number, ProcedureState>
  reorderPending?: boolean
  disabled?: boolean
  stagedDescriptions?: Record<number, string>
  removedItemIds?: number[]
  items?: ProcedureItem[]
  newSteps?: NewStep[]
}) {
  const state = opts?.state ?? {}
  const getProc = vi.fn(
    (id: number, fallback: string): ProcedureState =>
      state[id] ?? { status: "ok", description: fallback },
  )
  const setProc = vi.fn()
  const moveProcedureItem = vi.fn()
  const editProcedureItem = vi.fn()
  const removeProcedureItem = vi.fn()
  const restoreProcedureItem = vi.fn()
  const addStep = vi.fn()
  const updateStep = vi.fn()
  const commitStep = vi.fn()
  const editStep = vi.fn()
  const removeStep = vi.fn()
  render(
    <ProcedureSection
      items={opts?.items ?? items}
      getProc={getProc}
      setProc={setProc}
      moveProcedureItem={moveProcedureItem}
      reorderPending={opts?.reorderPending ?? false}
      editProcedureItem={editProcedureItem}
      removeProcedureItem={removeProcedureItem}
      restoreProcedureItem={restoreProcedureItem}
      stagedDescriptions={opts?.stagedDescriptions ?? {}}
      removedItemIds={opts?.removedItemIds ?? []}
      disabled={opts?.disabled ?? false}
      newSteps={opts?.newSteps ?? []}
      addStep={addStep}
      updateStep={updateStep}
      commitStep={commitStep}
      editStep={editStep}
      removeStep={removeStep}
    />,
  )
  return {
    getProc,
    setProc,
    moveProcedureItem,
    editProcedureItem,
    removeProcedureItem,
    restoreProcedureItem,
    addStep,
    updateStep,
    commitStep,
    editStep,
    removeStep,
  }
}

describe("ProcedureSection", () => {
  test("renders empty-state copy when no items or new steps", () => {
    setup({ items: [] })
    expect(
      screen.getByText("No procedure steps yet. Add one below."),
    ).toBeInTheDocument()
  })

  test("clicking 'Add step' calls addStep", async () => {
    const user = userEvent.setup()
    const { addStep } = setup({ items: [] })
    await user.click(screen.getByRole("button", { name: "Add step" }))
    expect(addStep).toHaveBeenCalledOnce()
  })

  test("an uncommitted new step renders an editable description and commits", async () => {
    const user = userEvent.setup()
    const { commitStep } = setup({
      items: [],
      newSteps: [
        {
          key: "a",
          description: "Clear gutters",
          committed: false,
          status: "ok",
          followupDescription: "",
        },
      ],
    })
    // The empty-state copy is hidden once a step is being added.
    expect(
      screen.queryByText("No procedure steps yet. Add one below."),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(commitStep).toHaveBeenCalledWith("a")
  })

  test("a committed new step shows OK/Needs followup radios with Edit/Remove", () => {
    setup({
      items: [],
      newSteps: [
        {
          key: "a",
          description: "Clear gutters",
          committed: true,
          status: "ok",
          followupDescription: "",
        },
      ],
    })
    expect(screen.getByText("Clear gutters")).toBeInTheDocument()
    expect(screen.getByLabelText("OK")).toBeInTheDocument()
    expect(screen.getByLabelText("Needs followup")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
  })

  test("selecting 'Needs followup' on a new step calls updateStep", async () => {
    const user = userEvent.setup()
    const { updateStep } = setup({
      items: [],
      newSteps: [
        {
          key: "a",
          description: "Clear gutters",
          committed: true,
          status: "ok",
          followupDescription: "",
        },
      ],
    })
    await user.click(screen.getByLabelText("Needs followup"))
    expect(updateStep).toHaveBeenCalledWith("a", { status: "followup" })
  })

  test("a committed new step in followup status shows the followup textfield", () => {
    setup({
      items: [],
      newSteps: [
        {
          key: "a",
          description: "Clear gutters",
          committed: true,
          status: "followup",
          followupDescription: "Gutters clogged",
        },
      ],
    })
    expect(screen.getByLabelText("Followup description")).toHaveValue(
      "Gutters clogged",
    )
  })

  test("renders one card per item", () => {
    setup()
    expect(screen.getByText("Check smoke alarm")).toBeInTheDocument()
    expect(screen.getByText("Test water valve")).toBeInTheDocument()
  })

  test("first item's Move up button is disabled", () => {
    setup()
    const upButtons = screen.getAllByRole("button", { name: "Move up" })
    expect(upButtons[0]).toBeDisabled()
    expect(upButtons[1]).not.toBeDisabled()
  })

  test("last item's Move down button is disabled", () => {
    setup()
    const downButtons = screen.getAllByRole("button", { name: "Move down" })
    expect(downButtons[downButtons.length - 1]).toBeDisabled()
  })

  test("clicking Move down on first item calls moveProcedureItem with +1", async () => {
    const user = userEvent.setup()
    const { moveProcedureItem } = setup()
    await user.click(screen.getAllByRole("button", { name: "Move down" })[0])
    expect(moveProcedureItem).toHaveBeenCalledWith(1, 1)
  })

  test("selecting 'Needs followup' calls setProc with followup status", async () => {
    const user = userEvent.setup()
    const { setProc } = setup()
    await user.click(screen.getAllByLabelText("Needs followup")[0])
    expect(setProc).toHaveBeenCalledWith(1, { status: "followup" })
  })

  test("description textfield appears only when status is followup", () => {
    setup({ state: { 1: { status: "followup", description: "rusted" } } })
    expect(screen.getByLabelText("Followup description")).toHaveValue("rusted")
  })

  test("each existing item exposes Edit and Remove buttons", () => {
    setup()
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2)
  })

  test("clicking Remove on an existing item stages removal via removeProcedureItem", async () => {
    const user = userEvent.setup()
    const { removeProcedureItem } = setup()
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0])
    expect(removeProcedureItem).toHaveBeenCalledWith(1)
  })

  test("editing an existing item's title stages it via editProcedureItem on Save", async () => {
    const user = userEvent.setup()
    const { editProcedureItem } = setup()
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0])
    const field = screen.getByLabelText("Description")
    await user.clear(field)
    await user.type(field, "Check smoke alarm battery")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(editProcedureItem).toHaveBeenCalledWith(
      1,
      "Check smoke alarm battery",
    )
  })

  test("an unchanged title does not call editProcedureItem on Save", async () => {
    const user = userEvent.setup()
    const { editProcedureItem } = setup()
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0])
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(editProcedureItem).not.toHaveBeenCalled()
  })

  test("Cancel exits edit mode without staging", async () => {
    const user = userEvent.setup()
    const { editProcedureItem } = setup()
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0])
    const field = screen.getByLabelText("Description")
    await user.clear(field)
    await user.type(field, "Something else")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(editProcedureItem).not.toHaveBeenCalled()
    expect(screen.getByText("Check smoke alarm")).toBeInTheDocument()
  })

  test("a staged rename is shown as the item title", () => {
    setup({ stagedDescriptions: { 1: "Check smoke alarm battery" } })
    expect(screen.getByText("Check smoke alarm battery")).toBeInTheDocument()
    expect(screen.queryByText("Check smoke alarm")).not.toBeInTheDocument()
  })

  test("re-saving a staged rename back to the original is a no-op", async () => {
    const user = userEvent.setup()
    const { editProcedureItem } = setup({
      stagedDescriptions: { 1: "Check smoke alarm battery" },
    })
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0])
    const field = screen.getByLabelText("Description")
    await user.clear(field)
    await user.type(field, "Check smoke alarm battery")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(editProcedureItem).not.toHaveBeenCalled()
  })

  test("a staged-for-removal item shows 'Will be removed' and a Restore button", () => {
    setup({ removedItemIds: [1] })
    expect(screen.getByText("Will be removed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument()
    // The status radios are hidden for a step that's being removed.
    expect(screen.getAllByLabelText("OK")).toHaveLength(1)
  })

  test("clicking Restore on a staged-for-removal item calls restoreProcedureItem", async () => {
    const user = userEvent.setup()
    const { restoreProcedureItem } = setup({ removedItemIds: [1] })
    await user.click(screen.getByRole("button", { name: "Restore" }))
    expect(restoreProcedureItem).toHaveBeenCalledWith(1)
  })

  test("disabled disables Edit, Remove and Restore buttons", () => {
    setup({ disabled: true, removedItemIds: [2] })
    const buttons = [
      ...screen.getAllByRole("button", { name: "Edit" }),
      ...screen.getAllByRole("button", { name: "Remove" }),
      ...screen.getAllByRole("button", { name: "Restore" }),
    ]
    expect(buttons.every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  test("reorderPending disables all move buttons", () => {
    setup({ reorderPending: true })
    const all = [
      ...screen.getAllByRole("button", { name: "Move up" }),
      ...screen.getAllByRole("button", { name: "Move down" }),
    ]
    expect(all.every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  })
})
