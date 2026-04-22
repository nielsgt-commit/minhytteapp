import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

export const useBookings = () => {
  const trpc = useTRPC()
  return useQuery(trpc.booking.list.queryOptions())
}