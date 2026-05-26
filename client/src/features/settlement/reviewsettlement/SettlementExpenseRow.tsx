import { type SyntheticEvent, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  Card,
  Dialog,
  Divider,
  Heading,
  Paragraph,
  Skeleton,
  Switch,
  Tag,
} from "@digdir/designsystemet-react"
import { ReceiptIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./SettlementExpenseRow.module.css"
import { EditExpenseDialog } from "./EditExpenseDialog"
import type { ExpenseRow } from "./useReviewSettlementData"
import { useTRPC } from "@/trpc/trpc"
import { useToggleState } from "@/hooks/useToggleState"

type Props = {
  expense: ExpenseRow
  editable: boolean
  openSettlementId: number | null
  onSaved: () => void
}

const basePayload = (e: ExpenseRow) => ({
  id: e.id,
  property_id: e.property_id ?? 0,
  description: e.description,
  amount: e.amount,
  reimbursed_by_id: e.reimbursed_by_id ?? undefined,
  booking_id: e.booking_id ?? undefined,
  maintenance_id: e.maintenance_id ?? undefined,
  date: e.date,
  status: e.status,
  receipt_url: e.receipt_url,
  expense_types: e.expense_types,
})

export function SettlementExpenseRow({
  expense,
  editable,
  openSettlementId,
  onSaved,
}: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const editDialog = useToggleState()
  const [category, setCategory] = useState<string>(
    expense.expense_types[0] ?? "",
  )

  const updateExpense = useMutation(
    trpc.expense.update.mutationOptions({
      onSuccess: () => {
        onSaved()
        editDialog.close()
      },
    }),
  )

  const linkedToClosed =
    expense.settlement_id != null
    && expense.settlement_id !== openSettlementId
  const included = expense.settlement_id != null

  const toggleIncluded = (next: boolean) => {
    if (openSettlementId == null) return
    if (linkedToClosed) return
    updateExpense.mutate({
      ...basePayload(expense),
      settlement_id: next ? openSettlementId : null,
    })
  }

  const submitCategory = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = category.trim()
    const nextTypes = trimmed === "" ? [] : [trimmed, ...expense.expense_types.slice(1)]
    updateExpense.mutate({
      ...basePayload(expense),
      expense_types: nextTypes,
      settlement_id: expense.settlement_id ?? undefined,
    })
  }

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <Paragraph asChild data-size="sm">
            <span className={styles.category}>
              {expense.expense_types[0] ?? t("(no category)")}
            </span>
          </Paragraph>
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
                    <Heading level={3} data-size="xs">{t("Receipt")}</Heading>
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
              <span>{expense.amount}</span>
            </Paragraph>
            <Paragraph asChild data-size="sm">
              <span>,-</span>
            </Paragraph>
          </div>
          <Paragraph className={styles.submittedByLabel} data-size="sm">
            {t("Paid by")}
          </Paragraph>
          <Tag className={styles.name} data-color="info" data-size="sm">
            {expense.payer_name ?? `#${String(expense.payer_id)}`}
          </Tag>
          <Divider className={styles.divider} />
          <div className={styles.actions}>
            <span
              title={
                !editable
                  ? t("Only the head can change this")
                  : linkedToClosed
                    ? t("Linked to a closed settlement — locked")
                    : openSettlementId == null
                      ? t("No open settlement — open one first")
                      : updateExpense.isPending
                        ? t("Saving…")
                        : included
                          ? t("Click to exclude")
                          : t("Click to include")
              }
            >
              <Switch
                label={t("Include")}
                position="end"
                data-size="sm"
                checked={included}
                disabled={
                  !editable
                  || linkedToClosed
                  || openSettlementId == null
                  || updateExpense.isPending
                }
                onChange={e => { toggleIncluded(e.target.checked) }}
              />
            </span>
            <EditExpenseDialog
              expenseId={expense.id}
              open={editDialog.value}
              onOpen={editDialog.open}
              onClose={editDialog.close}
              category={category}
              setCategory={setCategory}
              onSubmit={submitCategory}
              saving={updateExpense.isPending}
              errorMessage={updateExpense.error?.message ?? null}
              editable={editable}
            />
          </div>
        </Card.Block>
      </article>
    </Card>
  )
}

