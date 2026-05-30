import { type SyntheticEvent, useState } from "react"
import { Card, Heading, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./AddNewExpenseFlow.module.css"
import { useExpenseEditor } from "./useExpenseEditor"
import { useExpenseDrafts, type ExpenseDraft } from "./useExpenseDrafts.ts"
import { DraftList } from "./DraftList.tsx"
import { CategoryPicker } from "./CategoryPicker.tsx"
import { AmountEditor } from "./AmountEditor.tsx"
import { SubmitRow } from "./SubmitRow.tsx"

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
  const { t } = useTranslation("expenses")

  const drafts = useExpenseDrafts()
  const editor = useExpenseEditor()
  const [description, setDescription] = useState("")

  const parsedAmount = Number(editor.amount)

  const addDraft = () => {
    if (
      editor.openCategory == null ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    )
      return
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
            <Heading level={2} data-size="sm">
              {t("Add expense")}
            </Heading>

            <DraftList
              drafts={drafts.drafts}
              total={drafts.total}
              pending={pending}
              onRemove={drafts.remove}
            />

            <CategoryPicker
              categories={categories}
              pending={pending}
              openCategory={editor.openCategory}
              onOpenCategory={editor.open}
            />

            {editor.openCategory != null && (
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
                label={t("Description")}
                description={t("Optional")}
                value={description}
                onChange={e => {
                  setDescription(e.target.value)
                }}
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
