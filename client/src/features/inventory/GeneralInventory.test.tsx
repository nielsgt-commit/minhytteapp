// Behavior tests for the general inventory list. The shared InventoryList
// internals (delete, edit dialog, meta line) are covered through
// FoodInventory.test.tsx; this suite pins what differs: groups come from the
// property's general-kind categories (defaults in canonical order, customs
// last), and food-kind items never surface here.

import { beforeAll, describe, expect, test, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Temporal } from "temporal-polyfill"
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

type CategoryRow = { id: number; name: string; kind: "food" | "general" }

// Ids deliberately out of canonical order so the tests pin the client-side
// canonical sort (defaults first in their fixed order, customs last by id).
const CATEGORIES: CategoryRow[] = [
  { id: 203, name: "Games & books", kind: "general" },
  { id: 201, name: "Tools", kind: "general" },
  { id: 202, name: "Kitchen equipment", kind: "general" },
  { id: 204, name: "Sauna gear", kind: "general" },
  { id: 100, name: "Dry goods", kind: "food" },
]

type ItemRow = {
  id: number
  property_id: number
  name: string
  category_id: number
  category: string
  kind: "food" | "general"
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
    category_id: 201,
    category: "Tools",
    kind: "general",
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
    "inventoryCategory.list": vi.fn((input: unknown) => {
      const { kind } = input as { kind?: "food" | "general" }
      return CATEGORIES.filter(c => kind == null || c.kind === kind)
    }),
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

// The general-kind categories in canonical display order: defaults in their
// fixed order, the custom category last.
const ORDERED_GENERAL = [
  "Kitchen equipment",
  "Tools",
  "Games & books",
  "Sauna gear",
]

describe("GeneralInventory", () => {
  test("shows only non-empty groups; typing reveals every category chip in canonical order", async () => {
    const user = userEvent.setup()
    await renderList(
      makeHandlers([
        itemRow({
          id: 1,
          name: "Sauna bucket",
          category_id: 204,
          category: "Sauna gear",
        }),
      ]),
    )
    await screen.findByText("Sauna bucket")
    // Empty categories render no heading.
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map(h => h.textContent)
    expect(headings).toEqual(["Sauna gear"])

    // The category chips only appear while the quick-add input has text; they
    // cover ALL categories (also empty ones) in canonical order.
    expect(
      screen.queryByRole("radiogroup", { name: "Save to category" }),
    ).not.toBeInTheDocument()
    await user.type(screen.getByLabelText("New item"), "Axe")
    const chipGroup = screen.getByRole("radiogroup", {
      name: "Save to category",
    })
    const chips = within(chipGroup)
      .getAllByRole("radio")
      .map(r => r.closest("label")?.textContent)
    expect(chips).toEqual(ORDERED_GENERAL)
  })

  test("hides food items and never shows an Other group", async () => {
    await renderList(
      makeHandlers([
        itemRow({ id: 1, name: "Hammer" }),
        itemRow({
          id: 2,
          name: "Flour",
          category_id: 100,
          category: "Dry goods",
          kind: "food",
        }),
      ]),
    )
    await screen.findByText("Hammer")
    expect(screen.queryByText("Flour")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Other" }),
    ).not.toBeInTheDocument()
  })

  test("chip tap saves to that category; Enter repeats the last one", async () => {
    // The fake server keeps the created rows so the post-create invalidation
    // refetch does not wipe the optimistic entries.
    const items: ItemRow[] = []
    const handlers = makeHandlers(items)
    let nextId = 1
    const createHandler = vi.fn((input: unknown) => {
      const { name, category_id } = input as {
        name: string
        category_id: number
      }
      const row = itemRow({ id: nextId++, name, category_id })
      items.push(row)
      return row
    })
    handlers["inventoryItem.create"] = createHandler
    const user = userEvent.setup()
    await renderList(handlers)

    const input = await screen.findByLabelText("New item")
    await user.type(input, "Hammer")
    await user.click(screen.getByRole("radio", { name: "Tools" }))

    // The item appears under its (now non-empty, thus shown) group.
    expect(await screen.findByText("Hammer")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tools" })).toBeInTheDocument()
    await waitFor(() => {
      expect(createHandler).toHaveBeenCalledWith({
        property_id: 1,
        name: "Hammer",
        category_id: 201,
      })
    })
    // The input cleared and kept focus for the next item.
    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
    // The chips linger briefly after the save — with the picked one checked —
    // so the chosen category is visible as confirmation.
    expect(
      screen.getByRole("radiogroup", { name: "Save to category" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Tools" })).toBeChecked()

    // Enter submits to the last-used category without touching a chip.
    await user.type(input, "Saw{enter}")
    await waitFor(() => {
      expect(createHandler).toHaveBeenCalledWith({
        property_id: 1,
        name: "Saw",
        category_id: 201,
      })
    })
    expect(await screen.findByText("Saw")).toBeInTheDocument()

    // ...and once the linger elapses with an empty draft, the chips hide.
    await waitFor(
      () => {
        expect(
          screen.queryByRole("radiogroup", { name: "Save to category" }),
        ).not.toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  test("Enter with no previous category does nothing", async () => {
    const handlers = makeHandlers([])
    const createHandler = vi.fn()
    handlers["inventoryItem.create"] = createHandler
    const user = userEvent.setup()
    await renderList(handlers)

    const input = await screen.findByLabelText("New item")
    await user.type(input, "Hammer{enter}")
    expect(createHandler).not.toHaveBeenCalled()
    // The draft is kept so the chips stay available for a pick.
    expect(screen.getByLabelText("New item")).toHaveValue("Hammer")
  })
})
