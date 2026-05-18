import { type SyntheticEvent, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  Heading,
  Switch,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import styles from "./AddNewExpenseFlow.module.css"
import { useExpenseEditor } from "./useExpenseEditor"
import { useExpenseDrafts, type ExpenseDraft } from "./useExpenseDrafts.ts"
import { useCategoryMutations } from "./useCategoryMutations.ts"
import { DraftList } from "./DraftList.tsx"
import { CategoryPicker } from "./CategoryPicker.tsx"
import { AmountEditor } from "./AmountEditor.tsx"
import { SubmitRow } from "./SubmitRow.tsx"
import { useTRPC } from "@/trpc/trpc"

export type { ExpenseDraft } from "./useExpenseDrafts.ts"

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
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const drafts = useExpenseDrafts()
  const editor = useExpenseEditor()
  const [description, setDescription] = useState("")
  const [editMode, setEditMode] = useState(false)
  const suggestionInputRef = useRef<HTMLInputElement>(null)

  const {
    selectedCats,
    handleCategoriesChange,
    createError,
    archiveError,
  } = useCategoryMutations(categories, suggestionInputRef)

  const parsedAmount = Number(editor.amount)

  const addDraft = () => {
    if (editor.openCategory == null || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return
    drafts.add(editor.openCategory, Math.floor(parsedAmount))
    editor.close()
  }

  const resetForm = () => {
    drafts.reset()
    editor.close()
    setDescription("")
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (drafts.drafts.length === 0) return
    onSubmit(drafts.drafts, description.trim())
    resetForm()
  }

  return (
    <Card asChild>
      <form onSubmit={handleSubmit}>
        <Card.Block>
          <div className={styles.container}>
            <Heading level={2} data-size="sm">Add expense</Heading>

            <DraftList
              drafts={drafts.drafts}
              total={drafts.total}
              pending={pending}
              onRemove={drafts.remove}
            />

            {me?.is_head && (
              <Switch
                label="Edit mode"
                checked={editMode}
                onChange={e => {
                  const next = e.target.checked
                  setEditMode(next)
                  if (next) {
                    editor.close()
                  }
                }}
              />
            )}

            <CategoryPicker
              categories={categories}
              editMode={editMode}
              selectedCats={selectedCats}
              onCategoriesChange={handleCategoriesChange}
              suggestionInputRef={suggestionInputRef}
              pending={pending}
              openCategory={editor.openCategory}
              onOpenCategory={editor.open}
            />

            {createError && (
              <ValidationMessage>
                Error: {createError.message}
              </ValidationMessage>
            )}
            {archiveError && (
              <ValidationMessage>
                Error: {archiveError.message}
              </ValidationMessage>
            )}

            {!editMode && editor.openCategory != null && (
              <AmountEditor
                category={editor.openCategory}
                amount={editor.amount}
                onAmountChange={editor.setAmount}
                onAdd={addDraft}
                onCancel={editor.close}
                pending={pending}
              />
            )}

            {drafts.drafts.length > 0 && (
              <Textfield
                label="Description"
                description="Optional"
                value={description}
                onChange={e => { setDescription(e.target.value) }}
              />
            )}

            {drafts.drafts.length > 0 && (
              <SubmitRow pending={pending} onCancel={onCancel} />
            )}
          </div>
        </Card.Block>
      </form>
    </Card>
  )
}
