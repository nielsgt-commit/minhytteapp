import { useState } from "react"
import {
  Card,
  Divider,
  Dropdown,
  Paragraph,
  Switch,
  Tag,
} from "@digdir/designsystemet-react"
import { MenuElipsisVerticalIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import type { Temporal } from "temporal-polyfill"
import styles from "./SettlementExpenseRow.module.css"
import { EditExpenseDialog } from "./EditExpenseDialog"
import type { ExpenseRow } from "./useReviewSettlementData"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { useToggleState } from "@/hooks/useToggleState"
import { ReceiptDateButton } from "@/components/shared/ReceiptDateButton"

type Props = {
  expense: ExpenseRow
  editable: boolean
  openSettlementId: number | null
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
  receipt_date: e.receipt_date,
  status: e.status,
  receipt_url: e.receipt_url,
  expense_types: e.expense_types,
})

export function SettlementExpenseRow({
  expense,
  editable,
  openSettlementId,
}: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const editDialog = useToggleState()
  const [menuOpen, setMenuOpen] = useState(false)

  const updateExpense = useMutationWithInvalidation(
    trpc.expense.update.mutationOptions({
      onSuccess: () => {
        editDialog.close()
      },
    }),
    [trpc.expense.pathKey(), trpc.user.pathKey(), trpc.settlement.pathKey()],
  )

  const linkedToClosed =
    expense.settlement_id != null && expense.settlement_id !== openSettlementId
  const included = expense.settlement_id != null

  const toggleIncluded = (next: boolean) => {
    if (openSettlementId == null) return
    if (linkedToClosed) return
    updateExpense.mutate({
      ...basePayload(expense),
      settlement_id: next ? openSettlementId : null,
    })
  }

  const changeReceiptDate = (next: Temporal.PlainDate) => {
    updateExpense.mutate({
      ...basePayload(expense),
      settlement_id: expense.settlement_id ?? undefined,
      receipt_date: next,
    })
  }

  const submitCategory = async (fd: FormData) => {
    const raw = fd.get("category")
    const trimmed = (typeof raw === "string" ? raw : "").trim()
    const nextTypes =
      trimmed === "" ? [] : [trimmed, ...expense.expense_types.slice(1)]
    await updateExpense
      .mutateAsync({
        ...basePayload(expense),
        expense_types: nextTypes,
        settlement_id: expense.settlement_id ?? undefined,
      })
      .catch(() => undefined)
  }

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <div className={styles.cardHeader}>
            <Paragraph asChild data-size="sm">
              <span className={styles.category}>
                {expense.expense_types[0] ?? t("(no category)")}
              </span>
            </Paragraph>
            <span className={styles.menu}>
              <Dropdown.TriggerContext>
                <Dropdown.Trigger
                  variant="tertiary"
                  data-size="sm"
                  icon
                  aria-label={t("Expense actions")}
                  onClick={() => {
                    setMenuOpen(o => !o)
                  }}
                >
                  <MenuElipsisVerticalIcon aria-hidden />
                </Dropdown.Trigger>
                <Dropdown
                  placement="bottom-end"
                  open={menuOpen}
                  onClose={() => {
                    setMenuOpen(false)
                  }}
                >
                  <Dropdown.List>
                    <Dropdown.Item>
                      <Dropdown.Button
                        disabled={!editable || updateExpense.isPending}
                        onClick={() => {
                          setMenuOpen(false)
                          editDialog.open()
                        }}
                      >
                        {t("Edit")}
                      </Dropdown.Button>
                    </Dropdown.Item>
                  </Dropdown.List>
                </Dropdown>
              </Dropdown.TriggerContext>
            </span>
          </div>
          <span className={styles.receipt}>
            <ReceiptDateButton
              value={expense.receipt_date}
              onChange={changeReceiptDate}
              disabled={!editable || updateExpense.isPending}
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
                  !editable ||
                  linkedToClosed ||
                  openSettlementId == null ||
                  updateExpense.isPending
                }
                onChange={e => {
                  toggleIncluded(e.target.checked)
                }}
              />
            </span>
          </div>
          <EditExpenseDialog
            expenseId={expense.id}
            open={editDialog.value}
            onClose={editDialog.close}
            defaultCategory={expense.expense_types[0] ?? ""}
            onSubmit={submitCategory}
            saving={updateExpense.isPending}
            errorMessage={updateExpense.error?.message ?? null}
          />
          <ErrorAlert error={editDialog.value ? null : updateExpense.error} />
        </Card.Block>
      </article>
    </Card>
  )
}
