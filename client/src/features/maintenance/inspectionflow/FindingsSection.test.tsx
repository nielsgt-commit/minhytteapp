import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { FindingsSection, type AdHoc } from "./FindingsSection.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const makeAdHoc = (overrides: Partial<AdHoc> = {}): AdHoc => ({
  key: "k1",
  description: "",
  pin: false,
  committed: false,
  ...overrides,
})

function setup(adHocs: readonly AdHoc[] = []) {
  const handlers = {
    addAdHoc: vi.fn(),
    updateAdHoc: vi.fn(),
    commitAdHoc: vi.fn(),
    editAdHoc: vi.fn(),
    removeAdHoc: vi.fn(),
  }
  render(<FindingsSection adHocs={adHocs} {...handlers} />)
  return handlers
}

describe("FindingsSection", () => {
  test("calls addAdHoc when the add button is clicked", async () => {
    const user = userEvent.setup()
    const { addAdHoc } = setup()
    await user.click(screen.getByRole("button", { name: "Add finding" }))
    expect(addAdHoc).toHaveBeenCalledTimes(1)
  })

  test("renders editable description for an uncommitted finding", () => {
    setup([makeAdHoc({ description: "Leaky pipe" })])
    expect(screen.getByLabelText("Description")).toHaveValue("Leaky pipe")
  })

  test("Add button is disabled when description is blank", () => {
    setup([makeAdHoc({ description: "   " })])
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
  })

  test("commitAdHoc fires when Add is clicked on a non-empty finding", async () => {
    const user = userEvent.setup()
    const { commitAdHoc } = setup([makeAdHoc({ description: "Leak" })])
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(commitAdHoc).toHaveBeenCalledWith("k1")
  })

  test("renders committed finding as static row with Edit and Remove", () => {
    setup([makeAdHoc({ description: "Loose hinge", committed: true })])
    expect(screen.getByText("Loose hinge")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
  })

  test("editAdHoc fires when Edit is clicked on a committed row", async () => {
    const user = userEvent.setup()
    const { editAdHoc } = setup([
      makeAdHoc({ description: "Loose hinge", committed: true }),
    ])
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(editAdHoc).toHaveBeenCalledWith("k1")
  })

  test("removeAdHoc fires for both committed and uncommitted rows", async () => {
    const user = userEvent.setup()
    const { removeAdHoc } = setup([
      makeAdHoc({ key: "a", description: "x", committed: false }),
      makeAdHoc({ key: "b", description: "y", committed: true }),
    ])
    const removeButtons = screen.getAllByRole("button", { name: "Remove" })
    await user.click(removeButtons[0])
    await user.click(removeButtons[1])
    expect(removeMockCalls(removeAdHoc)).toEqual(["a", "b"])
  })
})

function removeMockCalls(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map(c => c[0] as string)
}
