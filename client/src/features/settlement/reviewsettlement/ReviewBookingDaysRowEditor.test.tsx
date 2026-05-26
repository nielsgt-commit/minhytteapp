import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  type DraftOccupant,
  EditActions,
  EditDates,
  OccupantChipInput,
  type UserOption,
} from "./ReviewBookingDaysRowEditor"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      if (vars == null) return key
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)),
        key,
      )
    },
  }),
}))

describe("EditDates", () => {
  test("renders both date inputs with the given values", () => {
    render(
      <EditDates
        draftStart="2026-01-10"
        draftEnd="2026-01-15"
        onChangeStart={() => {}}
        onChangeEnd={() => {}}
      />,
    )
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-10")
    expect(screen.getByLabelText("To")).toHaveValue("2026-01-15")
  })

  test("typing into 'From' invokes onChangeStart", async () => {
    const onChangeStart = vi.fn()
    const user = userEvent.setup()
    render(
      <EditDates
        draftStart="2026-01-10"
        draftEnd="2026-01-15"
        onChangeStart={onChangeStart}
        onChangeEnd={() => {}}
      />,
    )
    await user.clear(screen.getByLabelText("From"))
    expect(onChangeStart).toHaveBeenCalled()
  })

  test("'To' input has min set to draftStart", () => {
    render(
      <EditDates
        draftStart="2026-01-10"
        draftEnd="2026-01-15"
        onChangeStart={() => {}}
        onChangeEnd={() => {}}
      />,
    )
    expect(screen.getByLabelText("To")).toHaveAttribute("min", "2026-01-10")
  })
})

const USERS: UserOption[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
]

describe("OccupantChipInput", () => {
  test("renders one chip per draft", () => {
    const drafts: DraftOccupant[] = [
      { kind: "user", user_id: 1, name: "Alice", room_id: null },
      { kind: "guest", name: "Guest Sam" },
    ]
    render(
      <OccupantChipInput
        drafts={drafts}
        inputValue=""
        setInputValue={() => {}}
        users={USERS}
        datalistId="dl"
        onRemoveAt={() => {}}
        onCommit={() => {}}
      />,
    )
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Guest Sam")).toBeInTheDocument()
  })

  test("Enter key triggers onCommit", async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(
      <OccupantChipInput
        drafts={[]}
        inputValue="someone"
        setInputValue={() => {}}
        users={USERS}
        datalistId="dl"
        onRemoveAt={() => {}}
        onCommit={onCommit}
      />,
    )
    const input = screen.getByPlaceholderText("Add occupant…")
    input.focus()
    await user.keyboard("{Enter}")
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  test("Backspace on empty input removes the last draft", async () => {
    const onRemoveAt = vi.fn()
    const user = userEvent.setup()
    const drafts: DraftOccupant[] = [
      { kind: "user", user_id: 1, name: "Alice", room_id: null },
      { kind: "guest", name: "Sam" },
    ]
    render(
      <OccupantChipInput
        drafts={drafts}
        inputValue=""
        setInputValue={() => {}}
        users={USERS}
        datalistId="dl"
        onRemoveAt={onRemoveAt}
        onCommit={() => {}}
      />,
    )
    const input = screen.getByPlaceholderText("Add occupant…")
    input.focus()
    await user.keyboard("{Backspace}")
    expect(onRemoveAt).toHaveBeenCalledWith(1)
  })

  test("clicking a chip remove button calls onRemoveAt with its index", async () => {
    const onRemoveAt = vi.fn()
    const user = userEvent.setup()
    const drafts: DraftOccupant[] = [
      { kind: "user", user_id: 1, name: "Alice", room_id: null },
      { kind: "guest", name: "Sam" },
    ]
    render(
      <OccupantChipInput
        drafts={drafts}
        inputValue=""
        setInputValue={() => {}}
        users={USERS}
        datalistId="dl"
        onRemoveAt={onRemoveAt}
        onCommit={() => {}}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Remove Sam" }))
    expect(onRemoveAt).toHaveBeenCalledWith(1)
  })
})

describe("EditActions", () => {
  test("Save is disabled when bookerMissing", () => {
    render(
      <EditActions
        onSave={() => {}}
        onCancel={() => {}}
        saving={false}
        bookerMissing={true}
      />,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  test("Save is disabled when saving", () => {
    render(
      <EditActions
        onSave={() => {}}
        onCancel={() => {}}
        saving={true}
        bookerMissing={false}
      />,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })

  test("clicking Save / Cancel calls the corresponding handler", async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <EditActions
        onSave={onSave}
        onCancel={onCancel}
        saving={false}
        bookerMissing={false}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Save" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
