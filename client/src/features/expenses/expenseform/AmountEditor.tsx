import { Button, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { Temporal } from "temporal-polyfill"
import styles from "./AddNewExpenseFlow.module.css"
import { ReceiptDateButton } from "@/components/shared/ReceiptDateButton"

type Props = {
  category: string
  amount: string
  receiptDate: Temporal.PlainDate
  onAmountChange: (value: string) => void
  onReceiptDateChange: (next: Temporal.PlainDate) => void
  onAdd: () => void
  onCancel: () => void
  pending: boolean
}

export function AmountEditor({
  category,
  amount,
  receiptDate,
  onAmountChange,
  onReceiptDateChange,
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
        <ReceiptDateButton
          value={receiptDate}
          onChange={onReceiptDateChange}
          disabled={pending}
        />
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
