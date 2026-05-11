import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
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
import styles from "./ReviewExpenses.module.css"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import {
  NEXT_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"

type Status = "draft" | "submitted" | "reimbursed" | "rejected"

type ExpenseRow = {
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
  settlementId: number
  phase: SettlementPhase
}

export function ReviewExpenses({ settlementId, phase }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [stillAccepting, setStillAccepting] = useState(true)
  const [switchWarning, setSwitchWarning] = useState<string | null>(null)
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.expense.pathKey() })

  const updateExpense = useMutation(
    trpc.expense.update.mutationOptions({ onSuccess: invalidate }),
  )

  const advancePhase = useMutation(
    trpc.settlement.advancePhase.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })
      },
    }),
  )

  if (me == null || selectedPropertyId == null) return null

  if (!me.is_head) {
    return <p>Only the group head can review submitted expenses.</p>
  }

  const myGroup = groups.find(
    g => g.is_main && g.members.some(m => m.user_id === me.id),
  )
  const memberIds = new Set(myGroup?.members.map(m => m.user_id) ?? [])

  const toReview = (expenses as ExpenseRow[])
    .filter(
      e =>
        e.status === "submitted"
        && memberIds.has(e.payer_id)
        && e.payer_id !== me.id,
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  const basePayload = (e: ExpenseRow) => ({
    id: e.id,
    property_id: e.property_id ?? selectedPropertyId,
    description: e.description,
    amount: e.amount,
    booking_id: e.booking_id ?? undefined,
    maintenance_id: e.maintenance_id ?? undefined,
    date: e.date,
    receipt_url: e.receipt_url,
    expense_types: e.expense_types,
  })

  const reimburse = (e: ExpenseRow) => {
    updateExpense.mutate({
      ...basePayload(e),
      status: "reimbursed",
      reimbursed_by_id: me.id,
      settlement_id: settlementId,
    })
  }

  const reject = (e: ExpenseRow) => {
    updateExpense.mutate({
      ...basePayload(e),
      status: "rejected",
      reimbursed_by_id: e.reimbursed_by_id ?? undefined,
      settlement_id: e.settlement_id ?? undefined,
    })
  }

  const next = NEXT_PHASE.collecting_expenses

  const onSwitchChange = (checked: boolean) => {
    if (!checked && toReview.length > 0) {
      setSwitchWarning(
        `You still have ${String(toReview.length)} item${toReview.length === 1 ? "" : "s"} to review — finish the list before continuing.`,
      )
      return
    }
    setSwitchWarning(null)
    setStillAccepting(checked)
  }

  const header = (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm">Review expenses</Heading>
        <Switch
          label="Accept new expenses"
          position="end"
          data-size="sm"
          checked={stillAccepting}
          disabled={advancePhase.isPending || next == null}
          onChange={e => { onSwitchChange(e.target.checked) }}
        />
      </div>
      {switchWarning && (
        <Paragraph role="alert" data-size="sm">{switchWarning}</Paragraph>
      )}
    </>
  )

  if (toReview.length === 0) {
    if (phase === "collecting_expenses") {
      return (
        <>
          {header}
          <Card>No more items to review.</Card>
          <Paragraph data-size="sm">
            When you&apos;re done collecting expenses, turn off
            {" "}<em>Accept new expenses</em> and click
            {" "}<em>Continue to booking days</em>.
          </Paragraph>
          {!stillAccepting && next != null && (
            <Button
              type="button"
              data-size="sm"
              disabled={advancePhase.isPending}
              onClick={() => {
                advancePhase.mutate({
                  id: settlementId,
                  from: "collecting_expenses",
                  to: next,
                })
              }}
            >
              Continue to booking days
            </Button>
          )}
          {advancePhase.error && (
            <p role="alert">Error: {advancePhase.error.message}</p>
          )}
        </>
      )
    }
    return <p>(nothing to review)</p>
  }

  return (
    <>
      {header}
      <div className={styles.list}>
        {updateExpense.error && (
          <p role="alert">Error: {updateExpense.error.message}</p>
        )}
        {toReview.map(e => (
        <Card key={e.id} asChild>
          <article>
            <Card.Block className={styles.row} data-size="sm">
              <Paragraph asChild data-size="sm">
                <span className={styles.category}>
                  {e.expense_types[0] ?? "(no category)"}
                </span>
              </Paragraph>
              <span className={styles.receipt}>
                {e.receipt_url && (
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
                  <span className={styles.amount}>{e.amount}</span>
                </Paragraph>
                <Paragraph asChild data-size="sm">
                  <span className={styles.postfix}>,-</span>
                </Paragraph>
              </div>
              <Paragraph className={styles.submittedByLabel} data-size="sm">
                Submitted by
              </Paragraph>
              <Tag className={styles.name} data-color="info" data-size="sm">
                {e.payer_name ?? `#${String(e.payer_id)}`}
              </Tag>
              <Divider className={styles.divider} />
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  data-size="sm"
                  disabled={updateExpense.isPending}
                  onClick={() => { reimburse(e) }}
                >
                  Reimburse
                </Button>
                <Button
                  variant="tertiary"
                  data-color="danger"
                  data-size="sm"
                  disabled={updateExpense.isPending}
                  onClick={() => { reject(e) }}
                >
                  Reject
                </Button>
              </div>
            </Card.Block>
          </article>
        </Card>
      ))}
      </div>
    </>
  )
}
