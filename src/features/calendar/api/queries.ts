import { queryOptions, useQuery } from "@tanstack/react-query"
import { listBookings } from "@/backend"
import { bookingKeys } from "./keys"

export const bookingQueries = {
  list: () =>
    queryOptions({
      queryKey: bookingKeys.list(),
      queryFn: listBookings,
    }),
}

export const useBookings = () => useQuery(bookingQueries.list())
