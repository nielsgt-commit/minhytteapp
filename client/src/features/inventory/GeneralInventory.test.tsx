// Behavior tests for the general inventory list. The shared InventoryList
// internals (delete, edit dialog, meta line) are covered through
// FoodInventory.test.tsx; this suite pins what differs: the general section
// set, the absence of the "Other" fallback, and the food/general partition.

import { beforeAll, describe, expect, test, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Temporal } from "temporal-polyfill"
import { GENERAL_SECTIONS } from "@server/shared/inventorySections.ts"
import { renderWithProviders } from "@/test-utils/renderWithProviders"
import {
  createFakeTrpcClient,
  type FakeHandlers,
} from "@/test-utils/fakeTrpcClient"
import { GeneralInventory } from "./GeneralInventory"

// jsdom does not implement <dialog> methods; stub them so the edit dialog's
// content becomes visible/hidden the way the browser would show it.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event("close"))
  })
})

type ItemRow = {
  id: number
  property_id: number
  name: string
  category: string
  quantity: number | null
  location: string | null
  structure_id: number | null
  room_id: number | null
  created_at: Temporal.Instant
  created_by: number | null
}

function itemRow(
  over: Partial<ItemRow> & { id: number; name: string },
): ItemRow {
  return {
    property_id: 1,
    category: "Tools",
    quantity: null,
    location: null,
    structure_id: null,
    room_id: null,
    created_at: Temporal.Instant.from("2026-07-01T10:00:00Z"),
    created_by: null,
    ...over,
  }
}

function makeHandlers(items: ItemRow[]): FakeHandlers {
  return {
    "inventoryItem.listForProperty": vi.fn(() => items),
    "structure.listForProperty": vi.fn(() => [
      { id: 10, name: "Cabin" },
      { id: 11, name: "Annex" },
    ]),
    "room.listForProperty": vi.fn(() => [
      { id: 20, name: "Kitchen", structure_id: 10 },
      { id: 21, name: "Pantry", structure_id: 11 },
    ]),
  }
}

async function renderList(handlers: FakeHandlers) {
  return renderWithProviders(<GeneralInventory />, {
    initialSearch: { property: 1 },
    trpcClient: createFakeTrpcClient(handlers),
  })
}

describe("GeneralInventory", () => {
  test("renders every general section with its own add input", async () => {
    await renderList(
      makeHandlers([
        itemRow({ id: 1, name: "Fishing rod", category: "Outdoor & fishing" }),
      ]),
    )
    await screen.findByText("Fishing rod")
    for (const section of GENERAL_SECTIONS) {
      expect(screen.getByRole("heading", { name: section })).toBeInTheDocument()
      expect(
        screen.getByLabelText(`New item in ${section}`),
      ).toBeInTheDocument()
    }
  })

  test("hides food and legacy items and never shows an Other group", async () => {
    await renderList(
      makeHandlers([
        itemRow({ id: 1, name: "Hammer", category: "Tools" }),
        itemRow({ id: 2, name: "Flour", category: "Dry goods" }),
        itemRow({ id: 3, name: "Old thing", category: "Food" }),
      ]),
    )
    await screen.findByText("Hammer")
    expect(screen.queryByText("Flour")).not.toBeInTheDocument()
    expect(screen.queryByText("Old thing")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Other" }),
    ).not.toBeInTheDocument()
  })

  test("adds an item to a general section", async () => {
    // The fake server keeps the created row so the post-create invalidation
    // refetch does not wipe the optimistic entry.
    const items: ItemRow[] = []
    const handlers = makeHandlers(items)
    const createHandler = vi.fn((input: unknown) => {
      const { name, category } = input as { name: string; category: string }
      const row = itemRow({ id: 1, name, category })
      items.push(row)
      return row
    })
    handlers["inventoryItem.create"] = createHandler
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByRole("heading", { name: "Tools" })
    await user.type(screen.getByLabelText("New item in Tools"), "Hammer")
    await user.click(
      screen.getAllByRole("button", { name: "Add" })[
        GENERAL_SECTIONS.indexOf("Tools")
      ],
    )

    expect(await screen.findByText("Hammer")).toBeInTheDocument()
    await waitFor(() => {
      expect(createHandler).toHaveBeenCalledWith({
        property_id: 1,
        name: "Hammer",
        category: "Tools",
      })
    })
  })
})
