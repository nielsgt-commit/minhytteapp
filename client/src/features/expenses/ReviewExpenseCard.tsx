import {
  Button,
  Card,
  Dialog,
  Divider,
  Heading,
  Paragraph,
  Skeleton,
  Tag,
} from "@digdir/designsystemet-react"
import { ReceiptIcon } from "@navikt/aksel-icons"
import styles from "./ReviewExpenses.module.css"
import type { Status } from "./expenseStatus"

export type ExpenseRow = {
  id: number
  property_id: number | null
  description: string
  amount: number
  payer_id: number
  payer_name: string | null
  reimbursed_by_id: number | null
  booking_id: number | null
  maintenance_id: number | null
  settlement_id: number | null
  date: string
  status: Status
  receipt_url: string | null
  expense_types: string[]
}

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
  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <Paragraph asChild data-size="sm">
            <span className={styles.category}>
              {expense.expense_types[0] ?? "(no category)"}
            </span>
          </Paragraph>
          <span className={styles.receipt}>
            {expense.receipt_url && (
              <Dialog.TriggerContext>
                <Dialog.Trigger
                  variant="tertiary"
                  data-size="sm"
                  icon
                  aria-label="View receipt"
                >
                  <ReceiptIcon aria-hidden fontSize="1.25rem" />
                </Dialog.Trigger>
                <Dialog>
                  <Dialog.Block>
                    <Heading level={3} data-size="xs">Receipt</Heading>
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
            Sum
          </Paragraph>
          <div className={styles.amountGroup}>
            <Paragraph asChild data-size="sm">
              <span className={styles.amount}>{expense.amount}</span>
            </Paragraph>
            <Paragraph asChild data-size="sm">
              <span className={styles.postfix}>,-</span>
            </Paragraph>
          </div>
          <Paragraph className={styles.submittedByLabel} data-size="sm">
            Submitted by
          </Paragraph>
          <Tag className={styles.name} data-color="info" data-size="sm">
            {expense.payer_name ?? `#${String(expense.payer_id)}`}
          </Tag>
          <Divider className={styles.divider} />
          <div className={styles.actions}>
            <Button
              variant="secondary"
              data-size="sm"
              disabled={pending}
              onClick={() => { onReimburse(expense) }}
            >
              Reimburse
            </Button>
            <Button
              variant="tertiary"
              data-color="danger"
              data-size="sm"
              disabled={pending}
              onClick={() => { onReject(expense) }}
            >
              Reject
            </Button>
          </div>
        </Card.Block>
      </article>
    </Card>
  )
}
