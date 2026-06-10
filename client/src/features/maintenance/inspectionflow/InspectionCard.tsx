import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Tag,
  Button,
  Card,
  Chip,
  Paragraph,
} from "@digdir/designsystemet-react"
import type { PortableTextBlock } from "@portabletext/types"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { formatDate } from "@/utils/dateUtils"
import styles from "./InspectionCard.module.css"
import { MaintenanceInstructionsPT } from "@/features/maintenance/maintenancecard/MaintenanceInstructionsPT.tsx"
import {
  SeverityTag,
  cycleSeverity,
} from "@/features/maintenance/severity/SeverityTag.tsx"

type Inspection = {
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

export function InspectionCard({ inspection }: { inspection: Inspection }) {
  const { t, i18n } = useTranslation("maintenance")
  const cadenceLabel: Record<Inspection["recurrence"], string> = {
    yearly: t("Yearly"),
    "5year": t("Every 5 years"),
    spring: t("Every spring"),
    fall: t("Every fall"),
  }
  const trpc = useTRPC()
  const [expanded, setExpanded] = useState(false)
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(
    new Set(),
  )
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

  const updateMutation = useMutationWithInvalidation(
    trpc.maintenance.update.mutationOptions(),
    [trpc.maintenance.pathKey(), trpc.inspection.pathKey()],
  )
  const { error } = useMutationsStatus(updateMutation)

  const cycleFindingSeverity = (f: (typeof findings)[number]) => {
    updateMutation.mutate({
      id: f.id,
      description: f.description,
      instructions_pt: f.instructions_pt,
      assigned_to_id: f.assigned_to_id ?? undefined,
      structure_id: f.structure_id ?? undefined,
      infrastructure_id: f.infrastructure_id ?? undefined,
      equipment_id: f.equipment_id ?? undefined,
      category: f.category,
      severity: cycleSeverity(f.severity),
      status: f.status,
      recurrence: f.recurrence,
      due_kind: f.due_kind,
      due_priority_group_id: f.due_priority_group_id ?? undefined,
      due_at: f.due_at ? new Date(f.due_at) : undefined,
    })
  }

  const completedLabel = formatDate(inspection.completed_at, i18n.language)

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
          <Paragraph data-size="sm">
            {cadenceLabel[inspection.recurrence]}
          </Paragraph>
          <Button
            variant="tertiary"
            data-size="sm"
            onClick={() => {
              setExpanded(v => !v)
            }}
          >
            {expanded ? t("Hide details") : t("Show details")}
          </Button>
        </Card.Block>
        {expanded && (
          <Card.Block>
            <ErrorAlert error={error} />
            {inspection.notes_pt && inspection.notes_pt.length > 0 && (
              <MaintenanceInstructionsPT value={inspection.notes_pt} />
            )}
            {followups.length > 0 && (
              <>
                <Paragraph data-size="sm">
                  <strong>
                    {t("Followups raised ({{count}})", {
                      count: followups.length,
                    })}
                  </strong>
                </Paragraph>
                <ul>
                  {followups.map(f => {
                    const hasInstructions =
                      f.instructions_pt != null && f.instructions_pt.length > 0
                    const isExpanded = expandedFindings.has(f.id)
                    return (
                      <li key={f.id} className={styles.findingItem}>
                        <div className={styles.finding}>
                          <SeverityTag
                            severity={f.severity}
                            onCycle={() => {
                              cycleFindingSeverity(f)
                            }}
                            disabled={updateMutation.isPending}
                          />
                          <Paragraph data-size="sm">{f.description}</Paragraph>
                          {hasInstructions && (
                            <Chip.Button
                              type="button"
                              data-size="sm"
                              aria-expanded={isExpanded}
                              onClick={() => {
                                toggleFindingExpanded(f.id)
                              }}
                            >
                              {isExpanded
                                ? t("Hide execution")
                                : t("Show execution")}
                            </Chip.Button>
                          )}
                        </div>
                        {hasInstructions && isExpanded && (
                          <div className={styles.instructions}>
                            <MaintenanceInstructionsPT
                              value={f.instructions_pt}
                            />
                          </div>
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
                  <strong>
                    {t("Findings added ({{count}})", { count: adHocs.length })}
                  </strong>
                </Paragraph>
                <ul>
                  {adHocs.map(f => {
                    const hasInstructions =
                      f.instructions_pt != null && f.instructions_pt.length > 0
                    const isExpanded = expandedFindings.has(f.id)
                    return (
                      <li key={f.id} className={styles.findingItem}>
                        <div className={styles.finding}>
                          <SeverityTag
                            severity={f.severity}
                            onCycle={() => {
                              cycleFindingSeverity(f)
                            }}
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
                              onClick={() => {
                                toggleFindingExpanded(f.id)
                              }}
                            >
                              {isExpanded
                                ? t("Hide execution")
                                : t("Show execution")}
                            </Chip.Button>
                          )}
                        </div>
                        {hasInstructions && isExpanded && (
                          <div className={styles.instructions}>
                            <MaintenanceInstructionsPT
                              value={f.instructions_pt}
                            />
                          </div>
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
