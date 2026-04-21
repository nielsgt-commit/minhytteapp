import { useMutation, useQueryClient } from "@tanstack/react-query"
import { settleAll } from "@/backend"
import { settlementKeys } from "./keys"

export const useSettleAll = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settleAll,
    onSuccess: balances => {
      qc.setQueryData(settlementKeys.balances(), balances)
    },
  })
}
