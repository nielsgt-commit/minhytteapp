import { queryOptions, useQuery } from "@tanstack/react-query"
import { getDashboardSummary } from "@server/backend"
import { dashboardKeys } from "./keys"

export const dashboardQueries = {
  summary: () =>
    queryOptions({
      queryKey: dashboardKeys.summary(),
      queryFn: getDashboardSummary,
    }),
}

export const useDashboardSummary = () => useQuery(dashboardQueries.summary())
