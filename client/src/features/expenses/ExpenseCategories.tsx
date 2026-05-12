import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, List, Switch, Textfield, ValidationMessage } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

type ExpenseRow = {
  id: number
  amount: number
  expense_types: string[]
}

export function ExpenseCategories() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
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
    qc.invalidateQueries({ queryKey: trpc.expense.pathKey() })

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

  const archiveMutation = useMutation(
    trpc.expenseCategory.archive.mutationOptions({
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
        <Switch
          label="Edit mode"
          checked={editMode}
          onChange={e => {
            const next = e.target.checked
            setEditMode(next)
            if (!next) {
              setEditingId(null)
              setEditingName("")
            }
          }}
        />
      )}
      <List.Unordered>
        <List.Item>(no category) - {uncategorizedTotal}</List.Item>
        {categories.map(c => (
          <List.Item key={c.id}>
            {editMode && editingId === c.id ? (
              <form onSubmit={handleRename}>
                <Textfield
                  label="Category name"
                  value={editingName}
                  onChange={e => { setEditingName(e.target.value) }}
                  maxLength={64}
                  autoFocus
                  required
                />
                <Button type="submit" disabled={renameMutation.isPending}>
                  Save
                </Button>
                <Button
                  variant="secondary"
                  disabled={renameMutation.isPending}
                  onClick={() => {
                    setEditingId(null)
                    setEditingName("")
                  }}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <>
                {c.name} - {totals.get(c.name) ?? 0}
                {editMode && me?.is_head && (
                  <>
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setEditingId(c.id)
                        setEditingName(c.name)
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      disabled={archiveMutation.isPending}
                      onClick={() => { archiveMutation.mutate({ id: c.id }) }}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </>
            )}
          </List.Item>
        ))}
      </List.Unordered>
      {editMode && me?.is_head && (
        <form onSubmit={handleAdd}>
          <Textfield
            label="New category"
            value={newName}
            onChange={e => { setNewName(e.target.value) }}
            maxLength={64}
            required
          />
          <Button type="submit" disabled={createMutation.isPending}>
            Add
          </Button>
        </form>
      )}
      {createMutation.error && (
        <ValidationMessage>Error: {createMutation.error.message}</ValidationMessage>
      )}
      {renameMutation.error && (
        <ValidationMessage>Error: {renameMutation.error.message}</ValidationMessage>
      )}
      {archiveMutation.error && (
        <ValidationMessage>Error: {archiveMutation.error.message}</ValidationMessage>
      )}
    </section>
  )
}
