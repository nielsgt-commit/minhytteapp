import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Tag, Button, Card, Paragraph } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"

type Inspection = {
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

const cadenceLabel: Record<Inspection["recurrence"], string> = {
  once: "One-off",
  yearly: "Yearly",
  "5year": "Every 5 years",
}

export function InspectionCard({ inspection }: { inspection: Inspection }) {
  const trpc = useTRPC()
  const [expanded, setExpanded] = useState(false)

  const { data: findings = [] } = useQuery(
    trpc.inspection.listFindings.queryOptions(
      { inspection_id: inspection.id },
      { enabled: expanded },
    ),
  )

  const completedLabel = inspection.completed_at
    ? new Date(inspection.completed_at).toLocaleDateString()
    : ""

  const followups = findings.filter(f => f.parent_maintenance_id != null)
  const adHocs = findings.filter(f => f.parent_maintenance_id == null)

  return (
    <Card asChild>
      <article>
        <Card.Block
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <Tag data-color="info">Inspection</Tag>
          <Paragraph data-size="sm">{completedLabel}</Paragraph>
          <Paragraph data-size="sm" style={{ marginLeft: "auto" }}>
            {inspection.inspected_by}
          </Paragraph>
          <Paragraph data-size="sm">{cadenceLabel[inspection.recurrence]}</Paragraph>
          <Button
            variant="tertiary"
            data-size="sm"
            onClick={() => { setExpanded(v => !v) }}
          >
            {expanded ? "Hide details" : "Show details"}
          </Button>
        </Card.Block>
        {expanded && (
          <Card.Block>
            {inspection.notes && (
              <Paragraph data-size="sm">{inspection.notes}</Paragraph>
            )}
            {followups.length > 0 && (
              <>
                <Paragraph data-size="sm">
                  <strong>Followups raised ({followups.length})</strong>
                </Paragraph>
                <ul>
                  {followups.map(f => (
                    <li key={f.id}>
                      <Paragraph data-size="sm">{f.description}</Paragraph>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {adHocs.length > 0 && (
              <>
                <Paragraph data-size="sm">
                  <strong>Findings added ({adHocs.length})</strong>
                </Paragraph>
                <ul>
                  {adHocs.map(f => (
                    <li key={f.id}>
                      <Paragraph data-size="sm">
                        {f.description}
                        {f.is_pinned ? " (pinned)" : ""}
                      </Paragraph>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {findings.length === 0 && (
              <Paragraph data-size="sm">No findings recorded.</Paragraph>
            )}
          </Card.Block>
        )}
      </article>
    </Card>
  )
}
