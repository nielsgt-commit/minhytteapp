import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type ExpenseRow = {
  id: number
  amount: number
  expense_types: string[]
}

export function ExpenseCategories() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: expenses } = useSuspenseQuery(trpc.expense.list.queryOptions())
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions(),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editMode, setEditMode] = useState(false)

  const invalidateCategories = () =>
    qc.invalidateQueries({ queryKey: trpc.expenseCategory.list.queryKey() })
  const invalidateExpenses = () =>
    qc.invalidateQueries({ queryKey: trpc.expense.list.queryKey() })

  const createMutation = useMutation(
    trpc.expenseCategory.create.mutationOptions({
      onSuccess: () => {
        setNewName("")
        void invalidateCategories()
      },
    }),
  )

  const renameMutation = useMutation(
    trpc.expenseCategory.rename.mutationOptions({
      onSuccess: () => {
        setEditingId(null)
        setEditingName("")
        void invalidateCategories()
        void invalidateExpenses()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.expenseCategory.delete.mutationOptions({
      onSuccess: () => { void invalidateCategories() },
    }),
  )

  const totals = new Map<string, number>(categories.map(c => [c.name, 0]))
  let uncategorizedTotal = 0
  for (const e of expenses as ExpenseRow[]) {
    if (e.expense_types.length === 0) {
      uncategorizedTotal += e.amount
      continue
    }
    for (const t of e.expense_types) {
      totals.set(t, (totals.get(t) ?? 0) + e.amount)
    }
  }

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createMutation.mutate({ name })
  }

  const handleRename = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (editingId == null) return
    const name = editingName.trim()
    if (!name) return
    renameMutation.mutate({ id: editingId, name })
  }

  return (
    <section>
      <h3>Expense categories</h3>
      {me?.is_head && (
        <label>
          <input
            type="checkbox"
            checked={editMode}
            onChange={e => {
              const next = e.currentTarget.checked
              setEditMode(next)
              if (!next) {
                setEditingId(null)
                setEditingName("")
              }
            }}
          />
          Edit mode
        </label>
      )}
      <ul>
        <li>(no category) - {uncategorizedTotal}</li>
        {categories.map(c => (
          <li key={c.id}>
            {editMode && editingId === c.id ? (
              <form onSubmit={handleRename}>
                <input
                  type="text"
                  value={editingName}
                  onChange={e => { setEditingName(e.target.value) }}
                  maxLength={64}
                  autoFocus
                  required
                />
                <button type="submit" disabled={renameMutation.isPending}>
                  Save
                </button>
                <button
                  type="button"
                  disabled={renameMutation.isPending}
                  onClick={() => {
                    setEditingId(null)
                    setEditingName("")
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                {c.name} - {totals.get(c.name) ?? 0}
                {editMode && me?.is_head && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id)
                        setEditingName(c.name)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => { deleteMutation.mutate({ id: c.id }) }}
                    >
                      Remove
                    </button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {editMode && me?.is_head && (
        <form onSubmit={handleAdd}>
          <label>
            New category
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value) }}
              maxLength={64}
              required
            />
          </label>
          <button type="submit" disabled={createMutation.isPending}>
            Add
          </button>
        </form>
      )}
      {createMutation.error && (
        <p role="alert">Error: {createMutation.error.message}</p>
      )}
      {renameMutation.error && (
        <p role="alert">Error: {renameMutation.error.message}</p>
      )}
      {deleteMutation.error && (
        <p role="alert">Error: {deleteMutation.error.message}</p>
      )}
    </section>
  )
}