import { queryOptions, useQuery } from "@tanstack/react-query"
import { getExpense, listExpenses } from "@/backend"
import { expenseKeys } from "./keys"

export const expenseQueries = {
  list: () =>
    queryOptions({
      queryKey: expenseKeys.list(),
      queryFn: listExpenses,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: expenseKeys.detail(id),
      queryFn: () => getExpense(id),
    }),
}

export const useExpenses = () => useQuery(expenseQueries.list())

export const useExpense = (id: string) => useQuery(expenseQueries.detail(id))
