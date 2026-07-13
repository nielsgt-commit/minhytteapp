import {
  Button,
  Card,
  Dialog,
  Heading,
  Paragraph,
  Skeleton,
  Tag,
} from "@digdir/designsystemet-react"
import { ReceiptIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./ReviewExpenses.module.css"
import type { ExpenseRow } from "../types.ts"
import { CardKebabMenu } from "@/components/shared/CardKebabMenu"

type Props = {
  expense: ExpenseRow
  pending: boolean
  onReimburse: (expense: ExpenseRow) => void
  onReject: (expense: ExpenseRow) => void
}

export function ReviewExpenseCard({
  expense,
  pending,
  onReimburse,
  onReject,
}: Props) {
  const { t } = useTranslation("expenses")
  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <div className={styles.cardHeader}>
            <div className={styles.headerRow}>
              <Paragraph asChild data-size="sm">
                <span className={styles.category}>
                  {expense.expense_types[0] ?? t("(no category)")}
                </span>
              </Paragraph>
              <span className={styles.menu}>
                <CardKebabMenu
                  ariaLabel={t("Expense actions")}
                  items={[
                    {
                      label: t("Approve and mark as reimbursed"),
                      disabled: pending,
                      onSelect: () => {
                        onReimburse(expense)
                      },
                    },
                    {
                      label: t("Reject"),
                      danger: true,
                      disabled: pending,
                      onSelect: () => {
                        onReject(expense)
                      },
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
          <span className={styles.receipt}>
            {expense.receipt_url && (
              <Dialog.TriggerContext>
                <Dialog.Trigger
                  variant="tertiary"
                  data-size="sm"
                  icon
                  aria-label={t("View receipt")}
                >
                  <ReceiptIcon aria-hidden fontSize="1.25rem" />
                </Dialog.Trigger>
                <Dialog>
                  <Dialog.Block>
                    <Heading level={3} data-size="xs">
                      {t("Receipt")}
                    </Heading>
                  </Dialog.Block>
                  <Dialog.Block>
                    <Skeleton
                      className={styles.dialogImage}
                      variant="rectangle"
                    />
                  </Dialog.Block>
                </Dialog>
              </Dialog.TriggerContext>
            )}
          </span>
          <Paragraph className={styles.sumLabel} data-size="sm">
            {t("Sum")}
          </Paragraph>
          <div className={styles.amountGroup}>
            <Paragraph asChild data-size="sm">
              <span className={styles.amount}>{expense.amount}</span>
            </Paragraph>
            <Paragraph asChild data-size="sm">
              <span className={styles.postfix}>{t(",-")}</span>
            </Paragraph>
          </div>
          <Paragraph className={styles.submittedByLabel} data-size="sm">
            {t("Submitted by")}
          </Paragraph>
          <Tag className={styles.name} data-color="info" data-size="sm">
            {expense.payer_name ?? `#${String(expense.payer_id)}`}
          </Tag>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              data-size="sm"
              disabled={pending}
              onClick={() => {
                onReimburse(expense)
              }}
            >
              {t("Approve and mark as reimbursed")}
            </Button>
            <Button
              variant="tertiary"
              data-color="danger"
              data-size="sm"
              disabled={pending}
              onClick={() => {
                onReject(expense)
              }}
            >
              {t("Reject")}
            </Button>
          </div>
        </Card.Block>
      </article>
    </Card>
  )
}
