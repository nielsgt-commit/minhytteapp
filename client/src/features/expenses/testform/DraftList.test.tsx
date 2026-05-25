import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { DraftList } from "./DraftList.tsx"
import type { ExpenseDraft } from "./useExpenseDrafts.ts"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const drafts: ExpenseDraft[] = [
  { id: "a", category: "food", amount: 100 },
  { id: "b", category: "gas", amount: 50 },
]

describe("DraftList", () => {
  test("renders nothing when drafts is empty", () => {
    const { container } = render(
      <DraftList drafts={[]} total={0} pending={false} onRemove={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  test("renders one row per draft plus a total row", () => {
    render(
      <DraftList drafts={drafts} total={150} pending={false} onRemove={() => {}} />,
    )
    expect(screen.getByText("food — 100")).toBeInTheDocument()
    expect(screen.getByText("gas — 50")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("150")).toBeInTheDocument()
  })

  test("clicking Remove calls onRemove with the draft id", async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(
      <DraftList drafts={drafts} total={150} pending={false} onRemove={onRemove} />,
    )
    const buttons = screen.getAllByRole("button", { name: "Remove" })
    await user.click(buttons[0]!)
    expect(onRemove).toHaveBeenCalledWith("a")
  })

  test("disables every Remove button while pending", () => {
    render(
      <DraftList drafts={drafts} total={150} pending={true} onRemove={() => {}} />,
    )
    for (const btn of screen.getAllByRole("button", { name: "Remove" })) {
      expect(btn).toBeDisabled()
    }
  })
})
