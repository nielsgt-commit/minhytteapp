import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import styles from "./ReviewExpenses.module.css"
import { ReviewExpenseCard } from "./ReviewExpenseCard.tsx"
import { ReviewHeader } from "./ReviewHeader.tsx"
import { EmptyReviewState } from "./EmptyReviewState.tsx"
import { useReviewMutations } from "./useReviewMutations.ts"
import { useAcceptingToggle } from "./useAcceptingToggle.ts"
import type { ExpenseRow } from "../types.ts"
import { selectExpensesToReview } from "../selectors.ts"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import {
  NEXT_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type Props = {
  settlementId: number
  phase: SettlementPhase
}

export function ReviewExpenses({ settlementId, phase }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
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

  const advancePhase = useMutation(
    trpc.settlement.advancePhase.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })
      },
    }),
  )

  const myGroup = groups.find(
    g => g.is_main && g.members.some(m => m.user_id === me?.id),
  )
  const memberIds = new Set(myGroup?.members.map(m => m.user_id) ?? [])

  const toReview =
    me != null
      ? selectExpensesToReview(expenses as ExpenseRow[], memberIds, me.id)
      : []

  const { stillAccepting, switchWarning, onSwitchChange } =
    useAcceptingToggle(toReview.length)

  const { reimburse, reject, pending, error } = useReviewMutations({
    settlementId,
    reviewerId: me?.id ?? 0,
    fallbackPropertyId: selectedPropertyId ?? 0,
  })

  if (me == null || selectedPropertyId == null) return null

  if (!me.is_head) {
    return <p>Only the group head can review submitted expenses.</p>
  }

  const next = NEXT_PHASE.collecting_expenses

  const header = (
    <ReviewHeader
      stillAccepting={stillAccepting}
      disabled={advancePhase.isPending || next == null}
      switchWarning={switchWarning}
      onSwitchChange={onSwitchChange}
    />
  )

  if (toReview.length === 0) {
    return (
      <>
        {header}
        <EmptyReviewState
          phase={phase}
          stillAccepting={stillAccepting}
          next={next}
          advancePending={advancePhase.isPending}
          advanceError={advancePhase.error}
          onContinue={() => {
            if (next == null) return
            advancePhase.mutate({
              id: settlementId,
              from: "collecting_expenses",
              to: next,
            })
          }}
        />
      </>
    )
  }

  return (
    <>
      {header}
      <div className={styles.list}>
        {error && (
          <p role="alert">Error: {error.message}</p>
        )}
        {toReview.map(e => (
          <ReviewExpenseCard
            key={e.id}
            expense={e}
            pending={pending}
            onReimburse={reimburse}
            onReject={reject}
          />
        ))}
      </div>
    </>
  )
}
