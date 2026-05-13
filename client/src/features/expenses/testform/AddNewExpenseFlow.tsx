import { type SyntheticEvent, useEffect, useRef, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Chip,
  EXPERIMENTAL_Suggestion as Suggestion,
  Heading,
  Switch,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import type { SuggestionItem } from "@digdir/designsystemet-react"
import { FolderIcon } from "@navikt/aksel-icons"
import { useTRPC } from "@/trpc/trpc"

export type ExpenseDraft = {
  id: string
  category: string
  amount: number
}

type Props = {
  categories: { id: number; name: string }[]
  pending: boolean
  onSubmit: (drafts: ExpenseDraft[], description: string) => void
  onCancel: () => void
}

const toSuggestionItems = (cats: { id: number; name: string }[]): SuggestionItem[] =>
  cats.map(c => ({ label: c.name, value: String(c.id) }))

export function AddNewExpenseFlow({
  categories,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const [drafts, setDrafts] = useState<ExpenseDraft[]>([])
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [selectedCats, setSelectedCats] = useState<SuggestionItem[]>(
    toSuggestionItems(categories),
  )
  const suggestionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelectedCats(toSuggestionItems(categories))
  }, [categories])

  const invalidateCategories = () =>
    qc.invalidateQueries({ queryKey: trpc.expenseCategory.list.queryKey() })

  const createCategoryMutation = useMutation(
    trpc.expenseCategory.create.mutationOptions({
      onSuccess: () => { void invalidateCategories() },
    }),
  )
  const archiveCategoryMutation = useMutation(
    trpc.expenseCategory.archive.mutationOptions({
      onSuccess: () => { void invalidateCategories() },
    }),
  )

  const total = drafts.reduce((sum, d) => sum + d.amount, 0)
  const parsedAmount = Number(amount)

  const openEditor = (categoryName: string) => {
    setOpenCategory(categoryName)
    setAmount("")
  }

  const cancelEditor = () => {
    setOpenCategory(null)
    setAmount("")
  }

  const addDraft = () => {
    if (openCategory == null || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return
    setDrafts(prev => [
      ...prev,
      {
        id: `${String(Date.now())}-${String(Math.random())}`,
        category: openCategory,
        amount: Math.floor(parsedAmount),
      },
    ])
    cancelEditor()
  }

  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }

  const resetForm = () => {
    setDrafts([])
    setOpenCategory(null)
    setAmount("")
    setDescription("")
  }

  const handleCategoriesChange = (next: SuggestionItem[]) => {
    const prevValues = new Set(selectedCats.map(s => s.value))
    const nextValues = new Set(next.map(s => s.value))
    for (const item of selectedCats) {
      if (nextValues.has(item.value)) continue
      const id = Number(item.value)
      if (Number.isInteger(id) && id > 0) {
        archiveCategoryMutation.mutate({ id })
      }
    }
    let created = false
    for (const item of next) {
      if (prevValues.has(item.value)) continue
      const name = item.label.trim()
      if (name.length > 0) {
        createCategoryMutation.mutate({ name })
        created = true
      }
    }
    setSelectedCats(next)
    if (created && suggestionInputRef.current) {
      const input = suggestionInputRef.current
      input.value = ""
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (drafts.length === 0) return
    onSubmit(drafts, description.trim())
    resetForm()
  }

  return (
    <Card asChild>
      <form onSubmit={handleSubmit}>
        <Card.Block>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <Heading level={3} data-size="sm">Add expense</Heading>

            {drafts.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {drafts.map(d => (
                  <li
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {d.category} — {d.amount}
                    </span>
                    <Button
                      type="button"
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      onClick={() => { removeDraft(d.id) }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "0.25rem",
                  }}
                >
                  <strong>Total</strong>
                  <strong>{total}</strong>
                </li>
              </ul>
            )}

            {me?.is_head && (
              <Switch
                label="Edit mode"
                checked={editMode}
                onChange={e => {
                  const next = e.target.checked
                  setEditMode(next)
                  if (next) {
                    setOpenCategory(null)
                    setAmount("")
                  }
                }}
              />
            )}

            {editMode ? (
              <Suggestion
                multiple
                creatable
                selected={selectedCats}
                onSelectedChange={handleCategoriesChange}
              >
                <Suggestion.Input
                  ref={suggestionInputRef}
                  placeholder="Add or remove categories"
                />
                <Suggestion.List>
                  {categories.map(c => (
                    <Suggestion.Option key={c.id} value={String(c.id)}>
                      {c.name}
                    </Suggestion.Option>
                  ))}
                </Suggestion.List>
              </Suggestion>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                {categories.map(c => (
                  <Chip.Button
                    key={c.id}
                    type="button"
                    disabled={pending || openCategory === c.name}
                    onClick={() => { openEditor(c.name) }}
                  >
                    {c.name}
                  </Chip.Button>
                ))}
              </div>
            )}

            {createCategoryMutation.error && (
              <ValidationMessage>
                Error: {createCategoryMutation.error.message}
              </ValidationMessage>
            )}
            {archiveCategoryMutation.error && (
              <ValidationMessage>
                Error: {archiveCategoryMutation.error.message}
              </ValidationMessage>
            )}

            {!editMode && openCategory != null && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <Textfield
                  label={`Amount for ${openCategory}`}
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={e => { setAmount(e.target.value) }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addDraft()
                    }
                  }}
                  autoFocus
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <FolderIcon aria-hidden fontSize="1.25rem" />
                  <Button
                    type="button"
                    variant="tertiary"
                    data-color="danger"
                    disabled={pending}
                  >
                    Remove
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={pending}
                  >
                    Upload receipt
                  </Button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={addDraft}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={pending}
                    onClick={cancelEditor}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {drafts.length > 0 && (
              <Textfield
                label="Description"
                description="Optional"
                value={description}
                onChange={e => { setDescription(e.target.value) }}
              />
            )}

            {drafts.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Button type="submit" disabled={pending}>
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={onCancel}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Card.Block>
      </form>
    </Card>
  )
}