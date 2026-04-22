import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

export const useCreateBooking = () => {
  const trpc = useTRPC()
  const qc = useQueryClient()
  return useMutation(
    trpc.booking.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.booking.list.queryKey() })
      },
    }),
  )
}