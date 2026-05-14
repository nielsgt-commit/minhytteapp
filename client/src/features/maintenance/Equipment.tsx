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
import { InspectionCard } from "@/features/maintenance/InspectionCard.tsx"
import { InspectionFlow } from "@/features/maintenance/InspectionFlow.tsx"
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
  const { data: maintenanceItems = [] } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: inspections = [] } = useQuery(
    trpc.inspection.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const buildingNameById = new Map(buildings.map(b => [b.id, b.name]))

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: trpc.equipment.pathKey(),
    })
    void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
  }

  const [schedulingId, setSchedulingId] = useState<number | null>(null)
  const [inspectingId, setInspectingId] = useState<number | null>(null)
  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null)

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
                const isInspecting = inspectingId === item.id
                const isHistoryOpen = historyOpenId === item.id
                const buildingName =
                  buildingNameById.get(item.building_id)
                  ?? `#${String(item.building_id)}`
                const itemMaintenance = maintenanceItems
                  .filter(
                    m => m.equipment_id === item.id && m.status === "done",
                  )
                  .slice()
                  .sort((a, b) => {
                    const aT = a.completed_at
                      ? new Date(a.completed_at).getTime()
                      : 0
                    const bT = b.completed_at
                      ? new Date(b.completed_at).getTime()
                      : 0
                    return bT - aT
                  })
                const itemInspections = inspections.filter(
                  i => i.equipment_id === item.id && i.completed_at != null,
                )
                type Entry =
                  | {
                      kind: "maintenance"
                      t: number
                      m: (typeof itemMaintenance)[number]
                    }
                  | {
                      kind: "inspection"
                      t: number
                      i: (typeof itemInspections)[number]
                    }
                const historyEntries: Entry[] = [
                  ...itemMaintenance.map(m => ({
                    kind: "maintenance" as const,
                    t: m.completed_at ? new Date(m.completed_at).getTime() : 0,
                    m,
                  })),
                  ...itemInspections.map(i => ({
                    kind: "inspection" as const,
                    t: i.completed_at ? new Date(i.completed_at).getTime() : 0,
                    i,
                  })),
                ].sort((a, b) => b.t - a.t)
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
                          {!isScheduling && !isInspecting && (
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
                          {!isInspecting && (
                            <Button
                              variant="secondary"
                              data-size="sm"
                              onClick={() => { setInspectingId(item.id) }}
                            >
                              Start inspection
                            </Button>
                          )}
                          {!isInspecting && (
                            <Button
                              variant="tertiary"
                              data-size="sm"
                              onClick={() => {
                                setHistoryOpenId(prev =>
                                  prev === item.id ? null : item.id,
                                )
                              }}
                            >
                              {isHistoryOpen ? "Hide history" : "Show history"}
                            </Button>
                          )}
                        </div>
                      </Card.Block>
                      {isScheduling && !isInspecting && (
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
                      {isHistoryOpen && !isInspecting && (
                        <Card.Block>
                          {historyEntries.length === 0 ? (
                            <Paragraph data-size="sm">
                              No history yet.
                            </Paragraph>
                          ) : (
                            <div className={styles.list}>
                              {historyEntries.map(entry => {
                                if (entry.kind === "inspection") {
                                  return (
                                    <InspectionCard
                                      key={`i-${String(entry.i.id)}`}
                                      inspection={entry.i}
                                    />
                                  )
                                }
                                const m = entry.m
                                return (
                                  <Card asChild key={`m-${String(m.id)}`}>
                                    <article>
                                      <Card.Block data-size="sm">
                                        <Paragraph data-size="sm">
                                          {m.completed_at
                                            ? new Date(
                                                m.completed_at,
                                              ).toLocaleDateString()
                                            : ""}{" "}
                                          — {m.description}
                                        </Paragraph>
                                      </Card.Block>
                                    </article>
                                  </Card>
                                )
                              })}
                            </div>
                          )}
                        </Card.Block>
                      )}
                      {isInspecting && (
                        <Card.Block>
                          <InspectionFlow
                            scope={{
                              kind: "equipment",
                              id: item.id,
                              name: item.name,
                            }}
                            open={isInspecting}
                            onClose={() => { setInspectingId(null) }}
                          />
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
