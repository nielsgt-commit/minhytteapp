import { useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

export function useInvalidateExpenses() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({ queryKey: trpc.expense.pathKey() })
}
