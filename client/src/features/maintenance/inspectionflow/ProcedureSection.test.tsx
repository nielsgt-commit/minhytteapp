import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import {
  ProcedureSection,
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
}) {
  const state = opts?.state ?? {}
  const getProc = vi.fn(
    (id: number, fallback: string): ProcedureState =>
      state[id] ?? { status: "ok", description: fallback },
  )
  const setProc = vi.fn()
  const moveProcedureItem = vi.fn()
  render(
    <ProcedureSection
      items={opts?.items ?? items}
      getProc={getProc}
      setProc={setProc}
      moveProcedureItem={moveProcedureItem}
      reorderPending={opts?.reorderPending ?? false}
    />,
  )
  return { getProc, setProc, moveProcedureItem }
}

describe("ProcedureSection", () => {
  test("renders empty-state copy when no items", () => {
    setup({ items: [] })
    expect(
      screen.getByText(
        "No pinned items yet. Add ad-hoc findings below and pin any that should recur next time.",
      ),
    ).toBeInTheDocument()
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
    await user.click(screen.getAllByRole("button", { name: "Move down" })[0]!)
    expect(moveProcedureItem).toHaveBeenCalledWith(1, 1)
  })

  test("selecting 'Needs followup' calls setProc with followup status", async () => {
    const user = userEvent.setup()
    const { setProc } = setup()
    await user.click(screen.getAllByLabelText("Needs followup")[0]!)
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
