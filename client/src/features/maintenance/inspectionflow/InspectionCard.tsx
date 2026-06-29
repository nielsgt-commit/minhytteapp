import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Tag,
  Button,
  Card,
  Details,
  Paragraph,
} from "@digdir/designsystemet-react"
import type { PortableTextBlock } from "@portabletext/types"
import { useTranslation } from "react-i18next"
import type { Temporal } from "temporal-polyfill"
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
import {
  type Cadence,
  cadenceLabel,
  priorityGroupLabel,
} from "./inspectionCadence.ts"

type Inspection = {
  id: number
  structure_id: number | null
  infrastructure_id: number | null
  equipment_id: number | null
  inspected_by: string
  recurrence: Cadence
  cadence_priority_group_name: string | null
  notes_pt: PortableTextBlock[] | null
  started_at: Temporal.Instant
  completed_at: Temporal.Instant | null
}

export function InspectionCard({ inspection }: { inspection: Inspection }) {
  const { t, i18n } = useTranslation("maintenance")
  const cadenceText =
    inspection.recurrence === "priority_week"
      ? inspection.cadence_priority_group_name != null
        ? priorityGroupLabel(t, inspection.cadence_priority_group_name)
        : t("Priority week")
      : cadenceLabel(t, inspection.recurrence)
  const trpc = useTRPC()
  const [expanded, setExpanded] = useState(false)

  const { data } = useQuery(
    trpc.inspection.listFindings.queryOptions(
      { inspection_id: inspection.id },
      { enabled: expanded },
    ),
  )
  const findings = data?.findings ?? []
  const stepsAdded = data?.stepsAdded ?? []

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
      due_at: f.due_at ?? undefined,
    })
  }

  const completedLabel = formatDate(inspection.completed_at, i18n.language)

  const followups = findings.filter(f => f.source_step_id != null)
  const adHocs = findings.filter(f => f.source_step_id == null)

  return (
    <Card asChild>
      <article>
        <Card.Block className={styles.header}>
          <Tag data-color="info">{t("Inspection")}</Tag>
          <Paragraph data-size="sm">{completedLabel}</Paragraph>
          <Paragraph data-size="sm" className={styles.inspector}>
            {inspection.inspected_by}
          </Paragraph>
          <Paragraph data-size="sm">{cadenceText}</Paragraph>
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
                        </div>
                        {hasInstructions && (
                          <Details data-size="sm">
                            <Details.Summary>
                              {t("Execution")}
                            </Details.Summary>
                            <Details.Content className={styles.instructions}>
                              <MaintenanceInstructionsPT
                                value={f.instructions_pt}
                              />
                            </Details.Content>
                          </Details>
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
                        </div>
                        {hasInstructions && (
                          <Details data-size="sm">
                            <Details.Summary>
                              {t("Execution")}
                            </Details.Summary>
                            <Details.Content className={styles.instructions}>
                              <MaintenanceInstructionsPT
                                value={f.instructions_pt}
                              />
                            </Details.Content>
                          </Details>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {stepsAdded.length > 0 && (
              <>
                <Paragraph data-size="sm">
                  <strong>
                    {t("Steps added to procedure ({{count}})", {
                      count: stepsAdded.length,
                    })}
                  </strong>
                </Paragraph>
                <ul>
                  {stepsAdded.map(s => (
                    <li key={s.id} className={styles.findingItem}>
                      <div className={styles.finding}>
                        <Paragraph data-size="sm">{s.description}</Paragraph>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {findings.length === 0 && stepsAdded.length === 0 && (
              <Paragraph data-size="sm">{t("No findings recorded.")}</Paragraph>
            )}
          </Card.Block>
        )}
      </article>
    </Card>
  )
}
