// Behavior tests for the food inventory list, driven through the fake tRPC
// terminating link (see ShoppingList.test.tsx for the pattern). Covers the
// optimistic add, the two-tap delete with its 4s auto-disarm, the meta line,
// and the edit dialog including the building/room pair.

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Temporal } from "temporal-polyfill"
import { renderWithProviders } from "@/test-utils/renderWithProviders"
import {
  createFakeTrpcClient,
  type FakeHandlers,
} from "@/test-utils/fakeTrpcClient"
import { FoodInventory } from "./FoodInventory"

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
  return renderWithProviders(<FoodInventory />, {
    initialSearch: { property: 1 },
    trpcClient: createFakeTrpcClient(handlers),
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe("FoodInventory", () => {
  test("prompts for a property when none is selected", async () => {
    await renderWithProviders(<FoodInventory />, {
      trpcClient: createFakeTrpcClient(makeHandlers([])),
    })
    expect(
      await screen.findByText(
        "Add or select a property to keep a food inventory.",
      ),
    ).toBeInTheDocument()
  })

  test("shows quantity, location, and building/room names in the meta line", async () => {
    await renderList(
      makeHandlers([
        itemRow({
          id: 1,
          name: "Coffee",
          quantity: 2,
          location: "Top shelf",
          structure_id: 10,
          room_id: 20,
        }),
        itemRow({ id: 2, name: "Salt" }),
      ]),
    )
    await screen.findByText("Coffee")
    expect(
      screen.getByText("× 2 · Top shelf · Cabin · Kitchen"),
    ).toBeInTheDocument()
  })

  test("adds an item optimistically and rolls back on error", async () => {
    const handlers = makeHandlers([itemRow({ id: 1, name: "Salt" })])
    handlers["inventoryItem.create"] = () =>
      Promise.reject(new Error("create failed"))
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByText("Salt")
    await user.type(screen.getByLabelText("New item"), "Doomed beans")
    await user.click(screen.getByRole("button", { name: "Add" }))

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Doomed beans")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Salt")).toBeInTheDocument()
  })

  test("delete is a two-tap action whose armed state times out", async () => {
    const handlers = makeHandlers([itemRow({ id: 1, name: "Salt" })])
    const deleteHandler = vi.fn(() => ({ ok: true }))
    handlers["inventoryItem.delete"] = deleteHandler
    await renderList(handlers)
    await screen.findByText("Salt")

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(
      screen.getByRole("button", { name: "Confirm delete?" }),
    ).toBeInTheDocument()
    expect(deleteHandler).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(4100)
    })
    expect(
      screen.queryByRole("button", { name: "Confirm delete?" }),
    ).not.toBeInTheDocument()
    expect(deleteHandler).not.toHaveBeenCalled()

    vi.useRealTimers()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }))
    await waitFor(() => {
      expect(deleteHandler).toHaveBeenCalledWith({ id: 1 })
    })
  })

  test("the edit dialog saves all fields including a building/room pair", async () => {
    const handlers = makeHandlers([itemRow({ id: 1, name: "Coffee" })])
    const updateHandler = vi.fn(() => ({ ok: true }))
    handlers["inventoryItem.update"] = updateHandler
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByText("Coffee")
    await user.click(screen.getByRole("button", { name: "Edit" }))

    await user.clear(screen.getByLabelText("Name"))
    await user.type(screen.getByLabelText("Name"), "Dark roast")
    await user.type(screen.getByLabelText("Quantity"), "3")
    await user.type(screen.getByLabelText("Location"), "Top shelf")
    // The room select stays disabled until a building is picked, and only
    // lists that building's rooms.
    expect(screen.getByLabelText("Room")).toBeDisabled()
    await user.selectOptions(screen.getByLabelText("Building"), "10")
    expect(screen.getByLabelText("Room")).toBeEnabled()
    expect(
      screen.queryByRole("option", { name: "Pantry" }),
    ).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Room"), "20")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(updateHandler).toHaveBeenCalledWith({
        property_id: 1,
        id: 1,
        name: "Dark roast",
        quantity: 3,
        location: "Top shelf",
        structure_id: 10,
        room_id: 20,
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Save" }),
      ).not.toBeInTheDocument()
    })
  })

  test("changing the building clears a room from another building", async () => {
    const handlers = makeHandlers([
      itemRow({ id: 1, name: "Coffee", structure_id: 10, room_id: 20 }),
    ])
    const updateHandler = vi.fn(() => ({ ok: true }))
    handlers["inventoryItem.update"] = updateHandler
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByText("Coffee")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.selectOptions(screen.getByLabelText("Building"), "11")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(updateHandler).toHaveBeenCalledWith(
        expect.objectContaining({ structure_id: 11, room_id: null }),
      )
    })
  })
})
