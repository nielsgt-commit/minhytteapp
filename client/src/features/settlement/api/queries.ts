import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { listBalances } from "@server/backend"
import { settlementKeys } from "./keys"

export const settlementQueries = {
  balances: () =>
    queryOptions({
      queryKey: settlementKeys.balances(),
      queryFn: listBalances,
    }),
}

export const useBalances = () => useSuspenseQuery(settlementQueries.balances())
