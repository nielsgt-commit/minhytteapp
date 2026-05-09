import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Card, Textfield } from "@digdir/designsystemet-react"
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
      queryKey: trpc.equipment.pathKey(),
    })
    void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
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
      const rawDescription = fd.get("description")
      const rawDue = fd.get("due_at")
      const description =
        typeof rawDescription === "string" ? rawDescription.trim() : ""
      const dueRaw = typeof rawDue === "string" ? rawDue.trim() : ""
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
      <Card asChild>
        <section>
          <Card.Block>
            <h3>Equipment</h3>
            <p>Select a property to see its equipment.</p>
          </Card.Block>
        </section>
      </Card>
    )
  }

  return (
    <Card asChild>
      <section>
        <Card.Block>
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
                        <Textfield
                          label="Task"
                          name="description"
                          defaultValue={`Service ${item.name}`}
                          required
                        />
                        <Textfield
                          label="Due"
                          type="date"
                          name="due_at"
                        />
                        <Button
                          type="submit"
                          disabled={
                            scheduleMutation.isPending || selectedUserId == null
                          }
                        >
                          Schedule
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={scheduleMutation.isPending}
                          onClick={() => { setSchedulingId(null) }}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <Button
                        variant="tertiary"
                        onClick={() => { setSchedulingId(item.id) }}
                      >
                        Schedule maintenance
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
        </Card.Block>
      </section>
    </Card>
  )
}