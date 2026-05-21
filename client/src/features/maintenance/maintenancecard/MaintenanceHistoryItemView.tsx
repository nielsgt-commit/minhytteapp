import { useState } from "react"
import { Button, Card, Chip, Paragraph, Textfield } from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import styles from "./MaintenanceHistory.module.css"

export type MaintenanceHistoryItemViewData = {
  id: number
  description: string
  instructions: string | null
  completed_at: string | Date | null
}

export function MaintenanceHistoryItemView(props: {
  item: MaintenanceHistoryItemViewData
  pending: boolean
  isDeleting: boolean
  deletingTyped: string
  onStartEdit: () => void
  onStartDelete: () => void
  onChangeTyped: (value: string) => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
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
  } = props
  const [expanded, setExpanded] = useState(false)
  const hasInstructions = item.instructions != null && item.instructions !== ""
  const completedLabel = item.completed_at
    ? new Date(item.completed_at).toLocaleDateString()
    : ""

  return (
    <Card key={item.id} asChild>
      <article>
        <Card.Block className={styles.row} data-size="sm">
          <Paragraph className={styles.date} data-size="sm">
            {completedLabel}
          </Paragraph>
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
            <Paragraph className={styles.instructions} data-size="sm">
              {item.instructions}
            </Paragraph>
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
