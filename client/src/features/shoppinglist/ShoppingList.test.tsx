// Behavior tests for the ShoppingList page, driven through the fake tRPC
// terminating link and a real QueryClient (see Todos.test.tsx for the
// pattern). Covers the optimistic add/toggle cache edits, the two-tap
// delete with its 4s auto-disarm timer, and section-scoped clearing.

import { afterEach, describe, expect, test, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Temporal } from "temporal-polyfill"
import { renderWithProviders } from "@/test-utils/renderWithProviders"
import {
  createFakeTrpcClient,
  type FakeHandlers,
} from "@/test-utils/fakeTrpcClient"
import { ShoppingList } from "./ShoppingList"

type ItemRow = {
  id: number
  property_id: number
  section: "food" | "other"
  name: string
  checked: boolean
  created_at: Temporal.Instant
  created_by: number | null
  assignee_ids: number[]
}

function itemRow(
  over: Partial<ItemRow> & { id: number; name: string },
): ItemRow {
  return {
    property_id: 1,
    section: "food",
    checked: false,
    created_at: Temporal.Instant.from("2026-07-01T10:00:00Z"),
    created_by: null,
    assignee_ids: [],
    ...over,
  }
}

function makeHandlers(items: ItemRow[]): FakeHandlers {
  return {
    "shoppingItem.listForProperty": vi.fn(() => items),
    "user.listForProperty": vi.fn(() => [
      { id: 7, name: "Kari" },
      { id: 8, name: "Ola" },
    ]),
  }
}

async function renderList(handlers: FakeHandlers) {
  return renderWithProviders(<ShoppingList />, {
    initialSearch: { property: 1 },
    trpcClient: createFakeTrpcClient(handlers),
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe("ShoppingList", () => {
  test("prompts for a property when none is selected", async () => {
    await renderWithProviders(<ShoppingList />, {
      trpcClient: createFakeTrpcClient(makeHandlers([])),
    })
    expect(
      await screen.findByText(
        "Add or select a property to keep a shared shopping list.",
      ),
    ).toBeInTheDocument()
  })

  test("sinks checked items to the bottom of their section", async () => {
    await renderList(
      makeHandlers([
        itemRow({ id: 1, name: "Milk", checked: true }),
        itemRow({ id: 2, name: "Bread" }),
        itemRow({ id: 3, name: "Soap", section: "other" }),
      ]),
    )
    await screen.findByText("Milk")
    // Checkboxes are labelled by item name and render in list order (the
    // dropdown menus also use list roles, so listitem queries are noisy).
    const order = screen
      .getAllByRole("checkbox")
      .map(c => c.getAttribute("aria-label"))
    // Food section: unchecked Bread before checked Milk; Other after.
    expect(order).toEqual(["Bread", "Milk", "Soap"])
  })

  test("adds an item optimistically and rolls back on error", async () => {
    const handlers = makeHandlers([itemRow({ id: 1, name: "Bread" })])
    handlers["shoppingItem.create"] = () =>
      Promise.reject(new Error("create failed"))
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByText("Bread")
    // First "New item" field belongs to the Food section.
    const [foodField] = screen.getAllByLabelText("New item")
    await user.type(foodField, "Doomed cheese")
    const [foodAdd] = screen.getAllByRole("button", { name: "Add" })
    await user.click(foodAdd)

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Doomed cheese")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Bread")).toBeInTheDocument()
  })

  test("toggling checked flips optimistically while the mutation is pending", async () => {
    const handlers = makeHandlers([itemRow({ id: 1, name: "Milk" })])
    let resolveUpdate!: (v: unknown) => void
    handlers["shoppingItem.update"] = () =>
      new Promise(resolve => {
        resolveUpdate = resolve
      })
    const user = userEvent.setup()
    await renderList(handlers)

    const checkbox = await screen.findByRole("checkbox", { name: "Milk" })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Milk" })).toBeChecked()
    })
    // Settle so the pending mutation doesn't leak into later tests.
    resolveUpdate({ ok: true })
    await waitFor(() => {
      expect(handlers["shoppingItem.listForProperty"]).toHaveBeenCalled()
    })
  })

  test("delete is a two-tap action whose armed state times out", async () => {
    const handlers = makeHandlers([itemRow({ id: 1, name: "Milk" })])
    const deleteHandler = vi.fn(() => ({ ok: true }))
    handlers["shoppingItem.delete"] = deleteHandler
    await renderList(handlers)
    await screen.findByText("Milk")

    // Fake timers only after the initial fetch has settled; fireEvent clicks
    // are synchronous so they don't depend on timer advancement.
    vi.useFakeTimers()
    // First tap arms the button...
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(
      screen.getByRole("button", { name: "Confirm delete?" }),
    ).toBeInTheDocument()
    expect(deleteHandler).not.toHaveBeenCalled()

    // ...and the armed state auto-clears after 4s.
    act(() => {
      vi.advanceTimersByTime(4100)
    })
    expect(
      screen.queryByRole("button", { name: "Confirm delete?" }),
    ).not.toBeInTheDocument()
    expect(deleteHandler).not.toHaveBeenCalled()

    // Two taps in quick succession actually delete (real timers again so the
    // async mutation dispatch can settle).
    vi.useRealTimers()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }))
    await waitFor(() => {
      expect(deleteHandler).toHaveBeenCalledWith({ id: 1 })
    })
  })

  test("assigning a user shows their name in the row optimistically", async () => {
    const handlers = makeHandlers([itemRow({ id: 1, name: "Milk" })])
    const assignHandler = vi.fn(() => new Promise(() => undefined))
    handlers["shoppingItem.setAssignee"] = assignHandler
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByText("Milk")
    await user.click(screen.getByRole("button", { name: "Assign to..." }))
    await user.click(await screen.findByRole("checkbox", { name: "Kari" }))

    expect(assignHandler).toHaveBeenCalledWith({
      property_id: 1,
      id: 1,
      user_id: 7,
    })
    // The assignee line renders the user's name (optimistic cache edit).
    const row = screen
      .getAllByRole("listitem")
      .find(r => r.textContent.includes("Milk"))
    await waitFor(() => {
      expect(row?.textContent).toContain("Kari")
    })
  })

  test("clear list empties only the armed section after confirmation", async () => {
    let rows = [
      itemRow({ id: 1, name: "Milk" }),
      itemRow({ id: 2, name: "Soap", section: "other" }),
    ]
    const handlers = makeHandlers(rows)
    handlers["shoppingItem.listForProperty"] = vi.fn(() => rows)
    const clearHandler = vi.fn((input: unknown) => {
      const { section } = input as { section: "food" | "other" }
      rows = rows.filter(r => r.section !== section)
      return { ok: true }
    })
    handlers["shoppingItem.clearSection"] = clearHandler
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByText("Milk")
    // Open the Food section's kebab. Both sections' dropdown contents exist
    // in the DOM (closed), so index selects the Food instance of each button.
    const [foodMenu] = screen.getAllByRole("button", { name: "List actions" })
    await user.click(foodMenu)
    // First click arms, second confirms.
    const [foodClear] = screen.getAllByRole("button", { name: "Clear list" })
    await user.click(foodClear)
    expect(clearHandler).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Confirm clear?" }))
    expect(clearHandler).toHaveBeenCalledWith({
      property_id: 1,
      section: "food",
    })

    // The refetch drops the food item; the other section survives.
    await waitFor(() => {
      expect(screen.queryByText("Milk")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Soap")).toBeInTheDocument()
  })

  test("renaming an item saves and leaves edit mode", async () => {
    let rows = [itemRow({ id: 1, name: "Milk" })]
    const handlers = makeHandlers(rows)
    handlers["shoppingItem.listForProperty"] = vi.fn(() => rows)
    const updateHandler = vi.fn(() => {
      rows = [itemRow({ id: 1, name: "Oat milk" })]
      return { ok: true }
    })
    handlers["shoppingItem.update"] = updateHandler
    const user = userEvent.setup()
    await renderList(handlers)

    await screen.findByText("Milk")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    // The edit form reuses the "New item" label; it's the one with a value.
    const editField = screen
      .getAllByLabelText("New item")
      .find(f => (f as HTMLInputElement).value === "Milk")
    if (!editField) throw new Error("edit field not found")
    await user.clear(editField)
    await user.type(editField, "Oat milk")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(updateHandler).toHaveBeenCalledWith({
        property_id: 1,
        id: 1,
        name: "Oat milk",
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Save" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText("Oat milk")).toBeInTheDocument()
  })
})
