import { Card, Divider, Heading, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./AddNewExpenseFlow.module.css"
import { useExpenseEditor } from "./useExpenseEditor"
import { useExpenseDrafts, type ExpenseDraft } from "./useExpenseDrafts.ts"
import { DraftList } from "./DraftList.tsx"
import { CategoryPicker } from "./CategoryPicker.tsx"
import { AmountEditor } from "./AmountEditor.tsx"
import { SubmitRow } from "./SubmitRow.tsx"
import { fdString } from "@/utils/formData"

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

  const submitDrafts = (fd: FormData) => {
    if (drafts.drafts.length === 0) return
    onSubmit(drafts.drafts, fdString(fd, "description").trim())
    drafts.reset()
    editor.close()
  }

  return (
    <Card asChild>
      <form action={submitDrafts}>
        <Card.Block>
          <div className={styles.container}>
            <DraftList
              drafts={drafts.drafts}
              total={drafts.total}
              pending={pending}
              onRemove={drafts.remove}
            />

            {drafts.drafts.length > 0 && <Divider />}

            <Heading level={2} data-size="sm">
              {t("Category")}
            </Heading>

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
                name="description"
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
