import {
  Button,
  Dialog,
  Heading,
  Label,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./SettlementExpenseRow.module.css"
import { CategorySelect } from "./CategorySelect"

type Props = {
  expenseId: number
  open: boolean
  onClose: () => void
  defaultCategory: string
  onSubmit: (fd: FormData) => Promise<void>
  saving: boolean
  errorMessage: string | null
}

// The dialog is opened programmatically (from the row's kebab menu), so there
// is no Dialog.Trigger here — only the controlled dialog itself.
export function EditExpenseDialog({
  expenseId,
  open,
  onClose,
  defaultCategory,
  onSubmit,
  saving,
  errorMessage,
}: Props) {
  const { t } = useTranslation("settlement")
  const formId = `edit-expense-${String(expenseId)}`
  return (
    <Dialog open={open} onClose={onClose}>
      <Dialog.Block>
        <Heading level={3} data-size="xs">
          {t("Edit category")}
        </Heading>
      </Dialog.Block>
      <Dialog.Block>
        <form id={formId} className={styles.editForm} action={onSubmit}>
          <Label>
            {t("Category")}
            <CategorySelect name="category" defaultValue={defaultCategory} />
          </Label>
        </form>
      </Dialog.Block>
      <Dialog.Block>
        <div className={styles.editActions}>
          <Button
            variant="tertiary"
            data-size="sm"
            type="button"
            onClick={() => {
              onClose()
            }}
          >
            {t("Cancel")}
          </Button>
          <Button
            variant="primary"
            data-size="sm"
            type="submit"
            form={formId}
            disabled={saving}
          >
            {t("Save")}
          </Button>
        </div>
        {errorMessage != null && (
          <Paragraph role="alert">
            {t("Error: {{message}}", { message: errorMessage })}
          </Paragraph>
        )}
      </Dialog.Block>
    </Dialog>
  )
}
