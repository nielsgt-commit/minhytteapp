import { Card, Checkbox, Label, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { PreviewConflicts } from "@/features/planstay/booking-logic"
import styles from "./UnassignedPanel.module.css"

export function UnassignedPanel({
  occupants,
  conflicts,
  onQueue,
}: {
  occupants: { user_id: number; queued: boolean }[]
  conflicts: PreviewConflicts | undefined
  onQueue: (userId: number, queued: boolean) => void
}) {
  const { t } = useTranslation("planstay")
  const isOverCap = (conflicts?.property.overCapacityBy ?? 0) > 0
  const allQueued = occupants.length > 0 && occupants.every(o => o.queued)

  // Card's data-color type is narrower than Tag's; cast to allow feedback colors
  const cardColor = (isOverCap ? "warning" : "neutral") as "neutral"
  return (
    <Card data-color={cardColor}>
      <Card.Block>
        <div className={styles.header}>
          <Label data-size="sm">{t("Unassigned")}</Label>
          <div className={styles.controls}>
            <Checkbox
              label={t("Queue")}
              checked={allQueued}
              disabled={occupants.length === 0}
              onChange={e => {
                for (const o of occupants) onQueue(o.user_id, e.target.checked)
              }}
            />
            <Tag data-color={isOverCap ? "warning" : "neutral"}>
              {occupants.length}
            </Tag>
          </div>
        </div>
      </Card.Block>
    </Card>
  )
}
