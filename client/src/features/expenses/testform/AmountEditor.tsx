import { Button, Textfield } from "@digdir/designsystemet-react"
import { FolderIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./AddNewExpenseFlow.module.css"

type Props = {
  category: string
  amount: string
  onAmountChange: (value: string) => void
  onAdd: () => void
  onCancel: () => void
  pending: boolean
}

export function AmountEditor({
  category,
  amount,
  onAmountChange,
  onAdd,
  onCancel,
  pending,
}: Props) {
  const { t } = useTranslation("expenses")
  return (
    <div className={styles.editor}>
      <Textfield
        label={t("Amount for {{category}}", { category })}
        type="number"
        min={1}
        step={1}
        value={amount}
        onChange={e => {
          onAmountChange(e.target.value)
        }}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault()
            onAdd()
          }
        }}
        autoFocus
      />
      <div className={styles.editorActions}>
        <FolderIcon aria-hidden fontSize="1.25rem" />
        <Button
          type="button"
          variant="tertiary"
          data-color="danger"
          disabled={pending}
        >
          {t("Remove")}
        </Button>
        <Button type="button" variant="tertiary" disabled={pending}>
          {t("Upload receipt")}
        </Button>
      </div>
      <div className={styles.editorButtons}>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={onAdd}
        >
          {t("Add")}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          disabled={pending}
          onClick={onCancel}
        >
          {t("Cancel")}
        </Button>
      </div>
    </div>
  )
}
