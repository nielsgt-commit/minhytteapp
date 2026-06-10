import type { ExpenseRow } from "../types.ts"
import { basePayload } from "../buildUpdatePayload.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"

type Params = {
  settlementId: number
  reviewerId: number
  fallbackPropertyId: number
}

export function useReviewMutations({
  settlementId,
  reviewerId,
  fallbackPropertyId,
}: Params) {
  const trpc = useTRPC()

  const updateExpense = useMutationWithInvalidation(
    trpc.expense.update.mutationOptions(),
    [trpc.expense.pathKey()],
  )

  const reimburse = (e: ExpenseRow) => {
    updateExpense.mutate({
      ...basePayload(e, fallbackPropertyId),
      status: "reimbursed",
      reimbursed_by_id: reviewerId,
      settlement_id: settlementId,
    })
  }

  const reject = (e: ExpenseRow) => {
    updateExpense.mutate({
      ...basePayload(e, fallbackPropertyId),
      status: "rejected",
      reimbursed_by_id: e.reimbursed_by_id ?? undefined,
      settlement_id: e.settlement_id ?? undefined,
    })
  }

  return {
    reimburse,
    reject,
    isPending: updateExpense.isPending,
    error: updateExpense.error,
  }
}
