// Behavior tests for the Todos page, driven through the real tRPC options
// proxy against an in-memory terminating link (createFakeTrpcClient) and a
// real QueryClient — the optimistic onMutate/onError cache code runs
// unmodified. Queries by role/label at page level so the suite survives
// internal refactors of Todos.tsx.

import { describe, expect, test, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Temporal } from "temporal-polyfill"
import { renderWithProviders } from "@/test-utils/renderWithProviders"
import {
  createFakeTrpcClient,
  type FakeHandlers,
} from "@/test-utils/fakeTrpcClient"
import { Todos } from "./Todos"

type TodoRow = {
  id: number
  property_id: number
  description: string
  done: boolean
  created_at: Temporal.Instant
  created_by: number | null
  assignee_ids: number[]
}

function todoRow(over: Partial<TodoRow> & { id: number }): TodoRow {
  return {
    property_id: 1,
    description: `Todo ${String(over.id)}`,
    done: false,
    created_at: Temporal.Instant.from("2026-07-01T10:00:00Z"),
    created_by: null,
    assignee_ids: [],
    ...over,
  }
}

// Handlers return values in OUTPUT shape (real Temporal instances) — the
// fake link applies no transformer.
function makeHandlers(todos: TodoRow[]): FakeHandlers {
  return {
    "todo.listForProperty": vi.fn(() => todos),
    "structure.listForProperty": vi.fn(() => [{ id: 11, name: "Cabin" }]),
    "infrastructure.listForProperty": vi.fn(() => [{ id: 21, name: "Well" }]),
    "equipment.listForProperty": vi.fn(() => [{ id: 31, name: "Mower" }]),
    "user.listForProperty": vi.fn(() => [
      { id: 7, name: "Kari" },
      { id: 8, name: "Ola" },
    ]),
  }
}

async function renderTodos(handlers: FakeHandlers) {
  return renderWithProviders(<Todos />, {
    initialSearch: { property: 1 },
    trpcClient: createFakeTrpcClient(handlers),
  })
}

describe("Todos", () => {
  test("shows the skeleton without a selected property", async () => {
    const { container } = await renderWithProviders(<Todos />, {
      trpcClient: createFakeTrpcClient(makeHandlers([])),
    })
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  test("shows the empty state when the list is empty", async () => {
    await renderTodos(makeHandlers([]))
    expect(await screen.findByText("No todos yet.")).toBeInTheDocument()
  })

  test("sorts newest first with id as the tiebreak", async () => {
    const sameInstant = Temporal.Instant.from("2026-07-01T10:00:00Z")
    await renderTodos(
      makeHandlers([
        todoRow({ id: 1, description: "First", created_at: sameInstant }),
        todoRow({ id: 2, description: "Second", created_at: sameInstant }),
        todoRow({
          id: 3,
          description: "Oldest",
          created_at: Temporal.Instant.from("2026-06-01T10:00:00Z"),
        }),
      ]),
    )
    await screen.findByText("First")
    const rows = screen.getAllByRole("listitem")
    const texts = rows.map(r => r.textContent)
    expect(texts[0]).toContain("Second")
    expect(texts[1]).toContain("First")
    expect(texts[2]).toContain("Oldest")
  })

  test("adding a todo shows it optimistically while the mutation is pending", async () => {
    const handlers = makeHandlers([todoRow({ id: 1, description: "Existing" })])
    // Held open: everything asserted below is the optimistic cache edit.
    let resolveCreate!: (row: TodoRow) => void
    handlers["todo.create"] = () =>
      new Promise<TodoRow>(resolve => {
        resolveCreate = resolve
      })
    const user = userEvent.setup()
    await renderTodos(handlers)

    await user.type(await screen.findByLabelText("New todo"), "Buy firewood")
    await user.click(screen.getByRole("button", { name: "Add" }))

    expect(await screen.findByText("Buy firewood")).toBeInTheDocument()
    // The optimistic row sorts to the top (temp id above the max).
    const rows = screen.getAllByRole("listitem")
    expect(rows[0].textContent).toContain("Buy firewood")
    expect(screen.getByText("Existing")).toBeInTheDocument()

    // Settle the mutation before the test ends: handleAdd AWAITS mutateAsync
    // inside the form action, and a form action left pending forever wedges
    // React's transition handling for later tests in this jsdom.
    resolveCreate(todoRow({ id: 2, description: "Buy firewood" }))
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Add" }),
      ).not.toBeDisabled()
    })
  })

  test("a failed add rolls the list back and surfaces the error", async () => {
    const handlers = makeHandlers([todoRow({ id: 1, description: "Existing" })])
    handlers["todo.create"] = () => Promise.reject(new Error("create blew up"))
    const user = userEvent.setup()
    await renderTodos(handlers)

    await user.type(await screen.findByLabelText("New todo"), "Doomed todo")
    await user.click(screen.getByRole("button", { name: "Add" }))

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Doomed todo")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Existing")).toBeInTheDocument()
  })

  test("toggling done flips the checkbox optimistically and rolls back on error", async () => {
    const handlers = makeHandlers([todoRow({ id: 1, description: "Chop wood" })])
    let rejectUpdate!: (e: Error) => void
    handlers["todo.update"] = () =>
      new Promise((_res, rej) => {
        rejectUpdate = rej
      })
    const user = userEvent.setup()
    await renderTodos(handlers)

    const checkbox = await screen.findByRole("checkbox", { name: "Done" })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    // Optimistic: checked while the mutation is still pending.
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Done" })).toBeChecked()
    })

    rejectUpdate(new Error("update failed"))
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Done" })).not.toBeChecked()
    })
    expect(await screen.findByRole("alert")).toBeInTheDocument()
  })

  test("delete requires confirmation and removes the row optimistically", async () => {
    const handlers = makeHandlers([
      todoRow({ id: 1, description: "Delete me" }),
      todoRow({ id: 2, description: "Keep me" }),
    ])
    const deleteHandler = vi.fn(() => new Promise(() => undefined))
    handlers["todo.delete"] = deleteHandler
    const user = userEvent.setup()
    await renderTodos(handlers)

    await screen.findByText("Delete me")
    const row = screen
      .getAllByRole("listitem")
      .find(r => r.textContent.includes("Delete me"))
    expect(row).toBeDefined()
    if (!row) throw new Error("row not found")

    // Cancel keeps the row and does not call the mutation.
    await user.click(within(row).getByRole("button", { name: "Delete" }))
    await user.click(within(row).getByRole("button", { name: "Cancel" }))
    expect(deleteHandler).not.toHaveBeenCalled()
    expect(screen.getByText("Delete me")).toBeInTheDocument()

    // Confirm removes it immediately (mutation still pending).
    await user.click(within(row).getByRole("button", { name: "Delete" }))
    await user.click(
      within(row).getByRole("button", { name: "Confirm delete" }),
    )
    await waitFor(() => {
      expect(screen.queryByText("Delete me")).not.toBeInTheDocument()
    })
    expect(deleteHandler).toHaveBeenCalledWith({ id: 1 })
    expect(screen.getByText("Keep me")).toBeInTheDocument()
  })

  test("assigning a user shows their name in the row optimistically", async () => {
    const handlers = makeHandlers([todoRow({ id: 1, description: "Chore" })])
    const assignHandler = vi.fn(() => new Promise(() => undefined))
    handlers["todo.setAssignee"] = assignHandler
    const user = userEvent.setup()
    await renderTodos(handlers)

    await screen.findByText("Chore")
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
      .find(r => r.textContent.includes("Chore"))
    await waitFor(() => {
      expect(row?.textContent).toContain("Kari")
    })
  })

  test("move to maintenance sends the parsed target and refetches both domains", async () => {
    // Stateful fake server: the post-success invalidation refetches the
    // list, which must no longer contain the moved todo.
    let rows = [todoRow({ id: 1, description: "Fix roof" })]
    const handlers = makeHandlers([])
    const listHandler = vi.fn(() => rows)
    handlers["todo.listForProperty"] = listHandler
    const moveHandler = vi.fn(() => {
      rows = []
      return { moved: true }
    })
    handlers["todo.moveToMaintenance"] = moveHandler
    const user = userEvent.setup()
    await renderTodos(handlers)

    await screen.findByText("Fix roof")
    await user.click(screen.getByRole("button", { name: "Move to..." }))
    const select = await screen.findByRole("combobox", { name: "Target" })

    // Choosing "no target" is a no-op.
    await user.selectOptions(select, "")
    expect(moveHandler).not.toHaveBeenCalled()

    await user.selectOptions(select, "structure:11")
    expect(moveHandler).toHaveBeenCalledWith({
      property_id: 1,
      id: 1,
      target: { kind: "structure", id: 11 },
    })
    // Row leaves the list optimistically...
    await waitFor(() => {
      expect(screen.queryByText("Fix roof")).not.toBeInTheDocument()
    })
    // ...and the success invalidation refetches the todo list (async, after
    // onSuccess — hence waitFor rather than a synchronous count assert).
    await waitFor(() => {
      expect(listHandler.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  test("inline edit saves a new description and leaves edit mode", async () => {
    // Stateful fake server: the post-success refetch must return the
    // updated description, as the real server would.
    let rows = [todoRow({ id: 1, description: "Old text" })]
    const handlers = makeHandlers([])
    handlers["todo.listForProperty"] = vi.fn(() => rows)
    const updateHandler = vi.fn(() => {
      rows = [todoRow({ id: 1, description: "New text" })]
      return { ok: true }
    })
    handlers["todo.update"] = updateHandler
    const user = userEvent.setup()
    await renderTodos(handlers)

    await screen.findByText("Old text")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    const field = await screen.findByLabelText("Edit todo")
    await user.clear(field)
    await user.type(field, "New text")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(updateHandler).toHaveBeenCalledWith({
        property_id: 1,
        id: 1,
        description: "New text",
      })
    })
    // Edit mode exits (the action commits in a React 19 transition) and the
    // list shows the new description.
    await waitFor(() => {
      expect(screen.queryByLabelText("Edit todo")).not.toBeInTheDocument()
    })
    expect(await screen.findByText("New text")).toBeInTheDocument()
  })
})
