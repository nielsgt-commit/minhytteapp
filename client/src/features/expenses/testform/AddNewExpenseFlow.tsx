import { type SyntheticEvent, useState } from "react"
import {
  Button,
  Chip,
  Heading,
  Textfield,
} from "@digdir/designsystemet-react"
import { FolderIcon } from "@navikt/aksel-icons"

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

export function AddNewExpenseFlow({
  categories,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const [drafts, setDrafts] = useState<ExpenseDraft[]>([])
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")

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

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (drafts.length === 0) return
    onSubmit(drafts, description.trim())
    resetForm()
  }

  return (
    <form onSubmit={handleSubmit}>
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
              + {c.name}
            </Chip.Button>
          ))}
        </div>

        {openCategory != null && (
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
    </form>
  )
}
