import { Card, Paragraph } from "@digdir/designsystemet-react"
import { InspectionCard } from "@/features/maintenance/InspectionCard.tsx"

type MaintenanceEntry = {
  kind: "maintenance"
  t: number
  m: {
    id: number
    description: string
    completed_at: string | Date | null
  }
}

type InspectionEntry = {
  kind: "inspection"
  t: number
  i: {
    id: number
    structure_id: number | null
    infrastructure_id: number | null
    equipment_id: number | null
    inspected_by: string
    recurrence: "once" | "yearly" | "5year"
    notes: string | null
    started_at: string | Date
    completed_at: string | Date | null
  }
}

export type EquipmentHistoryEntryData = MaintenanceEntry | InspectionEntry

export function EquipmentHistoryEntry({
  entry,
}: {
  entry: EquipmentHistoryEntryData
}) {
  if (entry.kind === "inspection") {
    return <InspectionCard inspection={entry.i} />
  }
  const m = entry.m
  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Paragraph data-size="sm">
            {m.completed_at
              ? new Date(m.completed_at).toLocaleDateString()
              : ""}{" "}
            — {m.description}
          </Paragraph>
        </Card.Block>
      </article>
    </Card>
  )
}
