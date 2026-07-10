import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ReviewExpenses.module.css"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { ReviewExpenseCard } from "./ReviewExpenseCard.tsx"
import { ReviewHeader } from "./ReviewHeader.tsx"
import { EmptyReviewState } from "./EmptyReviewState.tsx"
import { useReviewMutations } from "./useReviewMutations.ts"
import type { ExpenseRow } from "../types.ts"
import { selectExpensesToReview } from "../selectors.ts"
import { type SettlementPhase } from "@server/shared/splitPolicy.ts"
import { useTRPC } from "@/trpc/trpc.ts"

type Props = {
  settlementId: number
  phase: SettlementPhase
  next: SettlementPhase | null
}

export function ReviewExpenses(props: Props) {
  return (
    <QueryBoundary>
      <ReviewExpensesContent {...props} />
    </QueryBoundary>
  )
}

function ReviewExpensesContent({ settlementId, phase, next }: Props) {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
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

  const advancePhase = useMutationWithInvalidation(
    trpc.settlement.advancePhase.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const myGroup = groups.find(
    g => g.is_family && g.members.some(m => m.user_id === me.id),
  )
  const memberIds = new Set(myGroup?.members.map(m => m.user_id) ?? [])

  const toReview = selectExpensesToReview(
    expenses as ExpenseRow[],
    memberIds,
    me.id,
  )

  const review = useReviewMutations({
    settlementId,
    reviewerId: me.id,
    fallbackPropertyId: selectedPropertyId ?? 0,
  })
  const status = useMutationsStatus(review, advancePhase)

  if (selectedPropertyId == null) return null

  const iAmHead = me.head_property_ids.includes(selectedPropertyId)
  if (!iAmHead) {
    return (
      <Paragraph>
        {t("Only the group head can review submitted expenses.")}
      </Paragraph>
    )
  }

  const header = <ReviewHeader />

  if (toReview.length === 0) {
    return (
      <>
        {header}
        <EmptyReviewState
          phase={phase}
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
        <ErrorAlert error={status.error} />
        {toReview.map(e => (
          <ReviewExpenseCard
            key={e.id}
            expense={e}
            pending={status.pending}
            onReimburse={review.reimburse}
            onReject={review.reject}
          />
        ))}
      </div>
    </>
  )
}
