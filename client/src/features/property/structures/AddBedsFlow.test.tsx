import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { AddBedsFlow, type RoomData } from "./AddBedsFlow.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const emptyBeds = {
  beds_sm: 0,
  beds_lg: 0,
  beds_double: 0,
  beds_kid: 0,
  mattresses: 0,
  travel_cot: 0,
}

const renderFlow = (overrides?: {
  defaults?: RoomData
  onSubmit?: (d: RoomData) => void
  onCancel?: () => void
  pending?: boolean
}) =>
  render(
    <AddBedsFlow
      legend="Add room"
      submitLabel="Save"
      pending={overrides?.pending ?? false}
      defaults={overrides?.defaults}
      onSubmit={overrides?.onSubmit ?? (() => {})}
      onCancel={overrides?.onCancel ?? (() => {})}
    />,
  )

describe("AddBedsFlow", () => {
  test("submit is suppressed when room name is empty/whitespace", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderFlow({ onSubmit })
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("submitting with only a name yields zero counts for every bed type", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderFlow({ onSubmit })
    await user.type(screen.getByLabelText("Room name"), "Loft")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onSubmit).toHaveBeenCalledWith({ name: "Loft", ...emptyBeds })
  })

  test("trims whitespace from name on submit", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderFlow({ onSubmit })
    await user.type(screen.getByLabelText("Room name"), "  Loft  ")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onSubmit.mock.calls[0]?.[0].name).toBe("Loft")
  })

  test("adding a bed type chip exposes a count field defaulting to 1", async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.click(screen.getByRole("button", { name: "+ Beds (single)" }))
    expect(screen.getByLabelText("Beds (single)")).toHaveValue(1)
  })

  test("removing a bed type takes it back to the chip row", async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.click(screen.getByRole("button", { name: "+ Beds (single)" }))
    await user.click(screen.getByRole("button", { name: "Remove" }))
    expect(screen.queryByLabelText("Beds (single)")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "+ Beds (single)" }),
    ).toBeInTheDocument()
  })

  test("submits with the entered bed counts", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderFlow({ onSubmit })
    await user.type(screen.getByLabelText("Room name"), "Bunk")
    await user.click(screen.getByRole("button", { name: "+ Beds (single)" }))
    const field = screen.getByLabelText("Beds (single)")
    await user.clear(field)
    await user.type(field, "3")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Bunk",
      ...emptyBeds,
      beds_sm: 3,
    })
  })

  test("pre-fills from defaults and only shows chips for missing bed types", () => {
    renderFlow({
      defaults: { name: "Master", ...emptyBeds, beds_double: 1 },
    })
    expect(screen.getByLabelText("Room name")).toHaveValue("Master")
    expect(screen.getByLabelText("Beds (double)")).toHaveValue(1)
    expect(
      screen.queryByRole("button", { name: "+ Beds (double)" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "+ Beds (single)" }),
    ).toBeInTheDocument()
  })

  test("Cancel button fires onCancel", async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    renderFlow({ onCancel })
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("pending disables Cancel and Remove buttons", async () => {
    const user = userEvent.setup()
    renderFlow({
      pending: true,
      defaults: { name: "x", ...emptyBeds, beds_sm: 1 },
    })
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled()
    // sanity: the chip row for available types is still present
    await user.click(screen.getByRole("button", { name: "+ Beds (large)" }))
    expect(screen.getByLabelText("Beds (large)")).toHaveValue(1)
  })
})
