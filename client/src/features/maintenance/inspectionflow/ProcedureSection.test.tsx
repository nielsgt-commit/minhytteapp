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

  test("reorderPending disables all move buttons", () => {
    setup({ reorderPending: true })
    const all = [
      ...screen.getAllByRole("button", { name: "Move up" }),
      ...screen.getAllByRole("button", { name: "Move down" }),
    ]
    expect(all.every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  })
})
