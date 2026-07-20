// The /handleliste page toggle: defaults to the shopping list, and switching
// to "Food inventory" swaps both the page title and the rendered list.

import { describe, expect, test, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test-utils/renderWithProviders"
import { createFakeTrpcClient } from "@/test-utils/fakeTrpcClient"
import { ShoppingPage } from "./ShoppingPage"

function makeHandlers() {
  return {
    "shoppingItem.listForProperty": vi.fn(() => []),
    "inventoryItem.listForProperty": vi.fn(() => []),
    "structure.listForProperty": vi.fn(() => []),
    "room.listForProperty": vi.fn(() => []),
    "user.me": vi.fn(() => ({ id: 7, name: "Kari" })),
    "user.listForProperty": vi.fn(() => []),
  }
}

describe("ShoppingPage", () => {
  test("defaults to the shopping list and toggles to the food inventory", async () => {
    const user = userEvent.setup()
    await renderWithProviders(<ShoppingPage />, {
      initialSearch: { property: 1 },
      trpcClient: createFakeTrpcClient(makeHandlers()),
    })

    // Default view: shopping list heading and its two sections.
    expect(
      await screen.findByRole("heading", { name: "Shopping list" }),
    ).toBeInTheDocument()
    expect(await screen.findByText("Food")).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "Food inventory" }))
    expect(
      await screen.findByRole("heading", { name: "Food inventory" }),
    ).toBeInTheDocument()
    // The shopping sections are gone; the inventory sections are present.
    expect(screen.queryByText("Food")).not.toBeInTheDocument()
    expect(screen.getByLabelText("New item in Dry goods")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Canned goods" }),
    ).toBeInTheDocument()
  })
})
