import { Card, Paragraph } from "@digdir/designsystemet-react"
import type { PortableTextBlock } from "@portabletext/types"
import { useTranslation } from "react-i18next"
import { formatDate } from "@/utils/dateUtils"
import { InspectionCard } from "@/features/maintenance/inspectionflow/InspectionCard.tsx"

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
    recurrence: "yearly" | "5year" | "spring" | "fall"
    notes_pt: PortableTextBlock[] | null
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
  const { i18n } = useTranslation("maintenance")
  if (entry.kind === "inspection") {
    return <InspectionCard inspection={entry.i} />
  }
  const m = entry.m
  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Paragraph data-size="sm">
            {formatDate(m.completed_at, i18n.language)} — {m.description}
          </Paragraph>
        </Card.Block>
      </article>
    </Card>
  )
}
