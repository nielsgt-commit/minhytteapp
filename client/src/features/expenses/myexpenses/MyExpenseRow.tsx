import { Button, Divider, Paragraph, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./MyExpenses.module.css"
import { STATUS_COLOR } from "../expenseStatus.ts"
import type { ExpenseRow } from "../types.ts"

type Props = {
  expense: ExpenseRow
  deletePending: boolean
  onEdit: () => void
  onDelete: () => void
}

export function MyExpenseRow({
  expense,
  deletePending,
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
      <Paragraph asChild data-size="sm">
        <span className={styles.category}>{categoryLabel}</span>
      </Paragraph>
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
      <Divider className={styles.divider} />
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
