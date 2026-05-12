import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Heading,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./Equipment.module.css"
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

  const [schedulingId, setSchedulingId] = useState<number | null>(null)

  const scheduleMutation = useMutation(
    trpc.equipment.scheduleMaintenance.mutationOptions({
      onSuccess: () => {
        setSchedulingId(null)
        invalidate()
      },
    }),
  )

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
            <Heading level={3} data-size="xs">Equipment</Heading>
            <p>Select a property to see its equipment.</p>
          </Card.Block>
        </section>
      </Card>
    )
  }

  const sortedEquipment = equipment.slice().sort((a, b) => {
    const aT = new Date(a.created_at).getTime()
    const bT = new Date(b.created_at).getTime()
    return bT - aT
  })

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={3} data-size="xs">Equipment</Heading>
        </Card.Block>
        <Card.Block>
          {scheduleMutation.error && (
            <p role="alert">Error: {scheduleMutation.error.message}</p>
          )}
          {sortedEquipment.length === 0 ? (
            <p>No equipment registered for this property yet.</p>
          ) : (
            <div className={styles.list}>
              {sortedEquipment.map(item => {
                const isScheduling = schedulingId === item.id
                const buildingName =
                  buildingNameById.get(item.building_id)
                  ?? `#${String(item.building_id)}`
                return (
                  <Card asChild key={item.id}>
                    <article>
                      <Card.Block className={styles.row} data-size="sm">
                        <Paragraph className={styles.name} data-size="sm">
                          {item.name}
                        </Paragraph>
                        <Paragraph
                          className={styles.building}
                          data-size="sm"
                        >
                          {buildingName}
                        </Paragraph>
                        <Paragraph
                          className={styles.category}
                          data-size="sm"
                        >
                          {item.category ?? ""}
                        </Paragraph>
                        <div className={styles.actions}>
                          {!isScheduling && (
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                setSchedulingId(item.id)
                              }}
                            >
                              Schedule maintenance
                            </Button>
                          )}
                        </div>
                      </Card.Block>
                      {isScheduling && (
                        <Card.Block>
                          <form
                            onSubmit={handleSubmit(item.id)}
                            className={styles.schedule}
                          >
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
                            <div className={styles.scheduleActions}>
                              <Button
                                type="submit"
                                data-size="sm"
                                disabled={
                                  scheduleMutation.isPending
                                  || selectedUserId == null
                                }
                              >
                                Schedule
                              </Button>
                              <Button
                                variant="secondary"
                                data-size="sm"
                                disabled={scheduleMutation.isPending}
                                onClick={() => {
                                  setSchedulingId(null)
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </Card.Block>
                      )}
                    </article>
                  </Card>
                )
              })}
            </div>
          )}
        </Card.Block>
      </section>
    </Card>
  )
}
