import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createExpense } from "@server/backend"
import type { Expense } from "@server/db"
import { expenseKeys } from "./keys"

export const useCreateExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: (created: Expense) => {
      qc.setQueryData(expenseKeys.detail(created.id), created)
      void qc.invalidateQueries({ queryKey: expenseKeys.list() })
    },
  })
}
