import { type SyntheticEvent, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  Button,
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
import styles from "./SettlementExpenseRow.module.css"
import { CategorySelect } from "./CategorySelect"
import type { ExpenseRow } from "./useReviewSettlementData"
import { useTRPC } from "@/trpc/trpc"

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
  const trpc = useTRPC()
  const [editOpen, setEditOpen] = useState(false)
  const [category, setCategory] = useState<string>(
    expense.expense_types[0] ?? "",
  )

  const updateExpense = useMutation(
    trpc.expense.update.mutationOptions({
      onSuccess: () => {
        onSaved()
        setEditOpen(false)
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
              <span>{expense.amount}</span>
            </Paragraph>
            <Paragraph asChild data-size="sm">
              <span>,-</span>
            </Paragraph>
          </div>
          <Paragraph className={styles.submittedByLabel} data-size="sm">
            Paid by
          </Paragraph>
          <Tag className={styles.name} data-color="info" data-size="sm">
            {expense.payer_name ?? `#${String(expense.payer_id)}`}
          </Tag>
          <Divider className={styles.divider} />
          <div className={styles.actions}>
            <span
              title={
                !editable
                  ? "Only the head can change this"
                  : linkedToClosed
                    ? "Linked to a closed settlement — locked"
                    : openSettlementId == null
                      ? "No open settlement — open one first"
                      : updateExpense.isPending
                        ? "Saving…"
                        : included
                          ? "Click to exclude"
                          : "Click to include"
              }
            >
              <Switch
                label="Include"
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
            <Dialog.TriggerContext>
              <Dialog.Trigger
                variant="secondary"
                data-size="sm"
                disabled={!editable || updateExpense.isPending}
                onClick={() => { setEditOpen(true) }}
              >
                Edit
              </Dialog.Trigger>
              <Dialog
                open={editOpen}
                onClose={() => { setEditOpen(false) }}
              >
                <Dialog.Block>
                  <Heading level={3} data-size="xs">Edit category</Heading>
                </Dialog.Block>
                <Dialog.Block>
                  <form
                    id={`edit-expense-${String(expense.id)}`}
                    className={styles.editForm}
                    onSubmit={submitCategory}
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
                      onClick={() => { setEditOpen(false) }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      data-size="sm"
                      type="submit"
                      form={`edit-expense-${String(expense.id)}`}
                      disabled={updateExpense.isPending}
                    >
                      Save
                    </Button>
                  </div>
                  {updateExpense.error && (
                    <Paragraph role="alert">
                      Error: {updateExpense.error.message}
                    </Paragraph>
                  )}
                </Dialog.Block>
              </Dialog>
            </Dialog.TriggerContext>
          </div>
        </Card.Block>
      </article>
    </Card>
  )
}

