import { queryOptions, useQuery } from "@tanstack/react-query"
import { listMaintenance } from "@/backend"
import { maintenanceKeys } from "./keys"

export const maintenanceQueries = {
  list: () =>
    queryOptions({
      queryKey: maintenanceKeys.list(),
      queryFn: listMaintenance,
    }),
}

export const useMaintenanceTasks = () => useQuery(maintenanceQueries.list())
