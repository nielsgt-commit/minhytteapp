import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createMaintenanceTask, setMaintenanceStatus } from "@server/backend"
import type { MaintenanceTask } from "@server/db"
import { maintenanceKeys } from "./keys"

export const useCreateMaintenanceTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMaintenanceTask,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: maintenanceKeys.list() })
    },
  })
}

export const useSetMaintenanceStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setMaintenanceStatus,
    onSuccess: updated => {
      qc.setQueryData<MaintenanceTask[]>(maintenanceKeys.list(), prev =>
        prev?.map(t => (t.id === updated.id ? updated : t)),
      )
    },
  })
}
