import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Tag, Button, Card, Chip, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./InspectionCard.module.css"
import { SeverityTag, cycleSeverity } from "@/features/maintenance/severity/SeverityTag.tsx"

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
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set())
  const toggleFindingExpanded = (id: number) => {
    setExpandedFindings(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const { data: findings = [] } = useQuery(
    trpc.inspection.listFindings.queryOptions(
      { inspection_id: inspection.id },
      { enabled: expanded },
    ),
  )

  const updateMutation = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
        void qc.invalidateQueries({ queryKey: trpc.inspection.pathKey() })
      },
    }),
  )

  const cycleFindingSeverity = (f: (typeof findings)[number]) => {
    updateMutation.mutate({
      id: f.id,
      description: f.description,
      instructions: f.instructions ?? undefined,
      added_by: f.added_by,
      assigned_to_id: f.assigned_to_id ?? undefined,
      structure_id: f.structure_id ?? undefined,
      infrastructure_id: f.infrastructure_id ?? undefined,
      category: f.category,
      severity: cycleSeverity(f.severity),
      status: f.status,
      recurrence: f.recurrence,
    })
  }

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
                  {followups.map(f => {
                    const hasInstructions = f.instructions != null && f.instructions !== ""
                    const isExpanded = expandedFindings.has(f.id)
                    return (
                      <li key={f.id} className={styles.findingItem}>
                        <div className={styles.finding}>
                          <SeverityTag
                            severity={f.severity}
                            onCycle={() => { cycleFindingSeverity(f) }}
                            disabled={updateMutation.isPending}
                          />
                          <Paragraph data-size="sm">{f.description}</Paragraph>
                          {hasInstructions && (
                            <Chip.Button
                              type="button"
                              data-size="sm"
                              aria-expanded={isExpanded}
                              onClick={() => { toggleFindingExpanded(f.id) }}
                            >
                              {isExpanded ? t("Hide execution") : t("Show execution")}
                            </Chip.Button>
                          )}
                        </div>
                        {hasInstructions && isExpanded && (
                          <Paragraph data-size="sm" className={styles.instructions}>
                            {f.instructions}
                          </Paragraph>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {adHocs.length > 0 && (
              <>
                <Paragraph data-size="sm">
                  <strong>{t("Findings added ({{count}})", { count: adHocs.length })}</strong>
                </Paragraph>
                <ul>
                  {adHocs.map(f => {
                    const hasInstructions = f.instructions != null && f.instructions !== ""
                    const isExpanded = expandedFindings.has(f.id)
                    return (
                      <li key={f.id} className={styles.findingItem}>
                        <div className={styles.finding}>
                          <SeverityTag
                            severity={f.severity}
                            onCycle={() => { cycleFindingSeverity(f) }}
                            disabled={updateMutation.isPending}
                          />
                          <Paragraph data-size="sm">
                            {f.description}
                            {f.is_pinned ? t(" (pinned)") : ""}
                          </Paragraph>
                          {hasInstructions && (
                            <Chip.Button
                              type="button"
                              data-size="sm"
                              aria-expanded={isExpanded}
                              onClick={() => { toggleFindingExpanded(f.id) }}
                            >
                              {isExpanded ? t("Hide execution") : t("Show execution")}
                            </Chip.Button>
                          )}
                        </div>
                        {hasInstructions && isExpanded && (
                          <Paragraph data-size="sm" className={styles.instructions}>
                            {f.instructions}
                          </Paragraph>
                        )}
                      </li>
                    )
                  })}
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
