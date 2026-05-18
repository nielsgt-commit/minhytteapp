import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react"
import styles from "./ReviewExpenses.module.css"
import { ReviewExpenseCard, type ExpenseRow } from "./ReviewExpenseCard"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import {
  NEXT_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"

type Props = {
  settlementId: number
  phase: SettlementPhase
}

function selectExpensesToReview(
  expenses: ExpenseRow[],
  memberIds: Set<number>,
  reviewerId: number,
): ExpenseRow[] {
  return expenses
    .filter(
      e =>
        e.status === "submitted"
        && memberIds.has(e.payer_id)
        && e.payer_id !== reviewerId,
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
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

  const toReview = selectExpensesToReview(
    expenses as ExpenseRow[],
    memberIds,
    me.id,
  )

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
          <ReviewExpenseCard
            key={e.id}
            expense={e}
            pending={updateExpense.isPending}
            onReimburse={reimburse}
            onReject={reject}
          />
        ))}
      </div>
    </>
  )
}
