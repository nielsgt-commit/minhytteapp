import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Tag, Button, Card, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./InspectionCard.module.css"

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

export function InspectionCard({ inspection }: { inspection: Inspection }) {
  const { t } = useTranslation("maintenance")
  const cadenceLabel: Record<Inspection["recurrence"], string> = {
    once: t("One-off"),
    yearly: t("Yearly"),
    "5year": t("Every 5 years"),
  }
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
        <Card.Block className={styles.header}>
          <Tag data-color="info">{t("Inspection")}</Tag>
          <Paragraph data-size="sm">{completedLabel}</Paragraph>
          <Paragraph data-size="sm" className={styles.inspector}>
            {inspection.inspected_by}
          </Paragraph>
          <Paragraph data-size="sm">{cadenceLabel[inspection.recurrence]}</Paragraph>
          <Button
            variant="tertiary"
            data-size="sm"
            onClick={() => { setExpanded(v => !v) }}
          >
            {expanded ? t("Hide details") : t("Show details")}
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
                  <strong>{t("Followups raised ({{count}})", { count: followups.length })}</strong>
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
                  <strong>{t("Findings added ({{count}})", { count: adHocs.length })}</strong>
                </Paragraph>
                <ul>
                  {adHocs.map(f => (
                    <li key={f.id}>
                      <Paragraph data-size="sm">
                        {f.description}
                        {f.is_pinned ? t(" (pinned)") : ""}
                      </Paragraph>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {findings.length === 0 && (
              <Paragraph data-size="sm">{t("No findings recorded.")}</Paragraph>
            )}
          </Card.Block>
        )}
      </article>
    </Card>
  )
}
