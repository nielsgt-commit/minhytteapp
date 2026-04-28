import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { selectSelectedUserId } from "@/features/user/userSlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function Equipment() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const selectedUserId = useAppSelector(selectSelectedUserId)

  const { data: equipment = [] } = useQuery(
    trpc.equipment.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )

  const buildingNameById = new Map(buildings.map(b => [b.id, b.name]))

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.equipment.listForProperty.queryKey({
        property_id: selectedPropertyId ?? 0,
      }),
    })
    void qc.invalidateQueries({ queryKey: trpc.maintenance.list.queryKey() })
  }

  const scheduleMutation = useMutation(
    trpc.equipment.scheduleMaintenance.mutationOptions({
      onSuccess: () => {
        setSchedulingId(null)
        invalidate()
      },
    }),
  )

  const [schedulingId, setSchedulingId] = useState<number | null>(null)

  const handleSubmit = (equipment_id: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (selectedUserId == null) return
      const fd = new FormData(e.currentTarget)
      const description = String(fd.get("description") ?? "").trim()
      const dueRaw = String(fd.get("due_at") ?? "").trim()
      if (!description) return
      scheduleMutation.mutate({
        equipment_id,
        description,
        added_by: selectedUserId,
        category: "maintenance",
        severity: "minor",
        recurrence: "once",
        due_at: dueRaw ? new Date(dueRaw) : undefined,
      })
    }

  if (selectedPropertyId == null) {
    return (
      <section>
        <h3>Equipment</h3>
        <p>Select a property to see its equipment.</p>
      </section>
    )
  }

  return (
    <section>
      <h3>Equipment</h3>
      {scheduleMutation.error && (
        <p role="alert">Error: {scheduleMutation.error.message}</p>
      )}
      {equipment.length === 0 ? (
        <p>No equipment registered for this property yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>id</th>
              <th>name</th>
              <th>building</th>
              <th>category</th>
              <th>actions</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map(item => {
              const isScheduling = schedulingId === item.id
              return (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{buildingNameById.get(item.building_id) ?? item.building_id}</td>
                  <td>{item.category ?? ""}</td>
                  <td>
                    {isScheduling ? (
                      <form onSubmit={handleSubmit(item.id)}>
                        <label>
                          Task
                          <input
                            type="text"
                            name="description"
                            defaultValue={`Service ${item.name}`}
                            required
                          />
                        </label>
                        <label>
                          Due
                          <input type="date" name="due_at" />
                        </label>
                        <button
                          type="submit"
                          disabled={
                            scheduleMutation.isPending || selectedUserId == null
                          }
                        >
                          Schedule
                        </button>
                        <button
                          type="button"
                          disabled={scheduleMutation.isPending}
                          onClick={() => { setSchedulingId(null) }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setSchedulingId(item.id) }}
                      >
                        Schedule maintenance
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}