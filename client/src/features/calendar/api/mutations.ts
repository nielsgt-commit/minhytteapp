import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createBooking } from "@server/backend"
import { bookingKeys } from "./keys"

export const useCreateBooking = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bookingKeys.list() })
    },
  })
}
