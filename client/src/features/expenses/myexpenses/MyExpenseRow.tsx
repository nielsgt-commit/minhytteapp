import { Button, Paragraph, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { Temporal } from "temporal-polyfill"
import styles from "./MyExpenses.module.css"
import { STATUS_COLOR } from "../expenseStatus.ts"
import type { ExpenseRow } from "../types.ts"
import { ReceiptDateButton } from "@/components/shared/ReceiptDateButton"
import { CardKebabMenu } from "@/components/shared/CardKebabMenu"

type Props = {
  expense: ExpenseRow
  deletePending: boolean
  receiptDatePending: boolean
  onReceiptDateChange: (next: Temporal.PlainDate) => void
  onEdit: () => void
  onDelete: () => void
}

export function MyExpenseRow({
  expense,
  deletePending,
  receiptDatePending,
  onReceiptDateChange,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation("expenses")
  const categoryLabel =
    expense.expense_types.length > 0
      ? expense.expense_types.join(", ")
      : t("(no category)")

  return (
    <>
      <div className={styles.cardHeader}>
        <div className={styles.headerRow}>
          <Paragraph asChild data-size="sm">
            <span className={styles.category}>{categoryLabel}</span>
          </Paragraph>
          <span className={styles.menu}>
            <CardKebabMenu
              ariaLabel={t("Expense actions")}
              items={[
                { label: t("Edit"), disabled: deletePending, onSelect: onEdit },
                {
                  label: t("Delete"),
                  danger: true,
                  disabled: deletePending,
                  onSelect: onDelete,
                },
              ]}
            />
          </span>
        </div>
        {expense.description.trim() !== "" && (
          <Paragraph className={styles.description} data-size="sm">
            {expense.description}
          </Paragraph>
        )}
      </div>
      <Paragraph className={styles.statusLabel} data-size="sm">
        {t("Status")}
      </Paragraph>
      <Tag
        className={styles.statusTag}
        data-color={STATUS_COLOR[expense.status]}
        data-size="sm"
      >
        {expense.status}
      </Tag>
      <span className={styles.receipt}>
        <ReceiptDateButton
          value={expense.receipt_date}
          onChange={onReceiptDateChange}
          disabled={receiptDatePending || deletePending}
        />
      </span>
      <Paragraph className={styles.sumLabel} data-size="sm">
        {t("Sum")}
      </Paragraph>
      <div className={styles.amountGroup}>
        <Paragraph asChild data-size="sm">
          <span>{expense.amount}</span>
        </Paragraph>
        <Paragraph asChild data-size="sm">
          <span>{t(",-")}</span>
        </Paragraph>
      </div>
      <div className={styles.actions}>
        <Button
          variant="tertiary"
          data-size="sm"
          disabled={deletePending}
          onClick={onEdit}
        >
          {t("Edit")}
        </Button>
        <Button
          variant="tertiary"
          data-color="danger"
          data-size="sm"
          disabled={deletePending}
          onClick={() => {
            onDelete()
          }}
        >
          {t("Delete")}
        </Button>
      </div>
    </>
  )
}
