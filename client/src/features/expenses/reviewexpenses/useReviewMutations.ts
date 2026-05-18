import { useMutation } from "@tanstack/react-query"
import type { ExpenseRow } from "../types.ts"
import { basePayload } from "../buildUpdatePayload.ts"
import { useInvalidateExpenses } from "../useInvalidateExpenses.ts"
import { useTRPC } from "@/trpc/trpc.ts"

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
  const invalidate = useInvalidateExpenses()

  const updateExpense = useMutation(
    trpc.expense.update.mutationOptions({ onSuccess: invalidate }),
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
    pending: updateExpense.isPending,
    error: updateExpense.error,
  }
}
