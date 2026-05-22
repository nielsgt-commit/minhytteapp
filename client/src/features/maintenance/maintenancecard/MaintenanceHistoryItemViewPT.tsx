import { useState } from "react"
import { Button, Card, Chip, Paragraph, Tag, Textfield } from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import type { PortableTextBlock } from "@portabletext/types"
import styles from "./MaintenanceHistory.module.css"
import { SeverityTag, type Severity } from "@/features/maintenance/severity/SeverityTag.tsx"
import { MaintenanceInstructionsPT } from "./MaintenanceInstructionsPT.tsx"

export type MaintenanceHistoryItemViewPTData = {
  id: number
  description: string
  instructions_pt: PortableTextBlock[] | null
  completed_at: string | Date | null
  severity: Severity
}

export function MaintenanceHistoryItemViewPT(props: {
  item: MaintenanceHistoryItemViewPTData
  pending: boolean
  isDeleting: boolean
  deletingTyped: string
  onStartEdit: () => void
  onStartDelete: () => void
  onChangeTyped: (value: string) => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onCycleSeverity: () => void
}) {
  const { t } = useTranslation("maintenance")
  const {
    item,
    pending,
    isDeleting,
    deletingTyped,
    onStartEdit,
    onStartDelete,
    onChangeTyped,
    onConfirmDelete,
    onCancelDelete,
    onCycleSeverity,
  } = props
  const [expanded, setExpanded] = useState(false)
  const hasInstructions =
    item.instructions_pt != null && item.instructions_pt.length > 0
  const completedLabel = item.completed_at
    ? new Date(item.completed_at).toLocaleDateString()
    : ""

  return (
    <Card key={item.id} asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <SeverityTag
            severity={item.severity}
            onCycle={onCycleSeverity}
            disabled={pending}
          />
          <Tag data-size="sm" className={styles.date}>
            {completedLabel}
          </Tag>
          <Paragraph className={styles.description} data-size="sm">
            {item.description}
          </Paragraph>
          <div className={styles.actions}>
            {hasInstructions && (
              <Chip.Button
                type="button"
                data-size="sm"
                aria-expanded={expanded}
                onClick={() => { setExpanded(v => !v) }}
              >
                {expanded ? t("Hide execution") : t("Show execution")}
              </Chip.Button>
            )}
            <Button
              variant="tertiary"
              data-size="sm"
              disabled={pending}
              onClick={onStartEdit}
            >
              {t("Edit")}
            </Button>
            {!isDeleting && (
              <Button
                variant="tertiary"
                data-color="danger"
                data-size="sm"
                disabled={pending}
                onClick={onStartDelete}
              >
                {t("Delete")}
              </Button>
            )}
          </div>
        </Card.Block>
        {hasInstructions && expanded && (
          <Card.Block>
            <MaintenanceInstructionsPT value={item.instructions_pt} />
          </Card.Block>
        )}
        {isDeleting && (
          <Card.Block>
            <div className={styles.confirm}>
              <Paragraph data-size="sm">
                <Trans
                  ns="maintenance"
                  i18nKey="Type <0>{{description}}</0> to confirm:"
                  values={{ description: item.description }}
                  components={[<code key="0" />]}
                />
              </Paragraph>
              <Textfield
                aria-label={t("Type description to confirm deletion")}
                data-size="sm"
                value={deletingTyped}
                onChange={e => { onChangeTyped(e.target.value) }}
              />
              <Button
                data-color="danger"
                data-size="sm"
                disabled={pending || deletingTyped !== item.description}
                onClick={onConfirmDelete}
              >
                {t("Confirm delete")}
              </Button>
              <Button
                variant="secondary"
                data-size="sm"
                disabled={pending}
                onClick={onCancelDelete}
              >
                {t("Cancel")}
              </Button>
            </div>
          </Card.Block>
        )}
      </article>
    </Card>
  )
}
