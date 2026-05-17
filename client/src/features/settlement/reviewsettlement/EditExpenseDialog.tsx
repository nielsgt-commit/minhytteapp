import { type SyntheticEvent } from "react"
import {
  Button,
  Dialog,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import styles from "./SettlementExpenseRow.module.css"
import { CategorySelect } from "./CategorySelect"

type Props = {
  expenseId: number
  open: boolean
  onOpen: () => void
  onClose: () => void
  category: string
  setCategory: (next: string) => void
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  saving: boolean
  errorMessage: string | null
  editable: boolean
}

export function EditExpenseDialog({
  expenseId,
  open,
  onOpen,
  onClose,
  category,
  setCategory,
  onSubmit,
  saving,
  errorMessage,
  editable,
}: Props) {
  const formId = `edit-expense-${String(expenseId)}`
  return (
    <Dialog.TriggerContext>
      <Dialog.Trigger
        variant="secondary"
        data-size="sm"
        disabled={!editable || saving}
        onClick={() => { onOpen() }}
      >
        Edit
      </Dialog.Trigger>
      <Dialog
        open={open}
        onClose={onClose}
      >
        <Dialog.Block>
          <Heading level={3} data-size="xs">Edit category</Heading>
        </Dialog.Block>
        <Dialog.Block>
          <form
            id={formId}
            className={styles.editForm}
            onSubmit={onSubmit}
          >
            <label>
              Category
              <CategorySelect
                value={category}
                onChange={setCategory}
              />
            </label>
          </form>
        </Dialog.Block>
        <Dialog.Block>
          <div className={styles.editActions}>
            <Button
              variant="tertiary"
              data-size="sm"
              type="button"
              onClick={() => { onClose() }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              data-size="sm"
              type="submit"
              form={formId}
              disabled={saving}
            >
              Save
            </Button>
          </div>
          {errorMessage != null && (
            <Paragraph role="alert">
              Error: {errorMessage}
            </Paragraph>
          )}
        </Dialog.Block>
      </Dialog>
    </Dialog.TriggerContext>
  )
}
