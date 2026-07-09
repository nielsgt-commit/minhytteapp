import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { Temporal } from "temporal-polyfill"
import { renderWithProviders } from "@/test-utils/renderWithProviders.tsx"
import { AmountEditor } from "./AmountEditor.tsx"

const receiptDate = Temporal.PlainDate.from("2026-07-01")

describe("AmountEditor", () => {
  test("uses the category name in the amount label", async () => {
    await renderWithProviders(
      <AmountEditor
        category="food"
        receiptDate={receiptDate}
        onReceiptDateChange={() => {}}
        amount=""
        onAmountChange={() => {}}
        onAdd={() => {}}
        onCancel={() => {}}
        pending={false}
      />,
    )
    expect(screen.getByLabelText("Amount for food")).toBeInTheDocument()
  })

  test("typing into the field calls onAmountChange", async () => {
    const onAmountChange = vi.fn()
    const user = userEvent.setup()
    await renderWithProviders(
      <AmountEditor
        category="food"
        receiptDate={receiptDate}
        onReceiptDateChange={() => {}}
        amount=""
        onAmountChange={onAmountChange}
        onAdd={() => {}}
        onCancel={() => {}}
        pending={false}
      />,
    )
    await user.type(screen.getByLabelText("Amount for food"), "5")
    expect(onAmountChange).toHaveBeenCalledWith("5")
  })

  test("pressing Enter inside the field calls onAdd", async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    await renderWithProviders(
      <AmountEditor
        category="food"
        receiptDate={receiptDate}
        onReceiptDateChange={() => {}}
        amount="10"
        onAmountChange={() => {}}
        onAdd={onAdd}
        onCancel={() => {}}
        pending={false}
      />,
    )
    const input = screen.getByLabelText("Amount for food")
    input.focus()
    await user.keyboard("{Enter}")
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  test("Add and Cancel buttons fire their callbacks", async () => {
    const onAdd = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    await renderWithProviders(
      <AmountEditor
        category="food"
        receiptDate={receiptDate}
        onReceiptDateChange={() => {}}
        amount="10"
        onAmountChange={() => {}}
        onAdd={onAdd}
        onCancel={onCancel}
        pending={false}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Add" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("disables every button while pending", async () => {
    await renderWithProviders(
      <AmountEditor
        category="food"
        receiptDate={receiptDate}
        onReceiptDateChange={() => {}}
        amount="10"
        onAmountChange={() => {}}
        onAdd={() => {}}
        onCancel={() => {}}
        pending={true}
      />,
    )
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    // The visible date button is aria-hidden; the real control is the
    // invisible native date input overlaying it.
    expect(screen.getByLabelText(/Date on receipt/)).toBeDisabled()
  })
})
