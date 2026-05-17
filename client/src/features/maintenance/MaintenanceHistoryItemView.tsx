import { Button, Card, Paragraph, Textfield } from "@digdir/designsystemet-react"
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
          <Paragraph className={styles.instructions} data-size="sm">
            {item.instructions ?? ""}
          </Paragraph>
          <div className={styles.actions}>
            <Button
              variant="tertiary"
              data-size="sm"
              disabled={pending}
              onClick={onStartEdit}
            >
              Edit
            </Button>
            {!isDeleting && (
              <Button
                variant="tertiary"
                data-color="danger"
                data-size="sm"
                disabled={pending}
                onClick={onStartDelete}
              >
                Delete
              </Button>
            )}
          </div>
        </Card.Block>
        {isDeleting && (
          <Card.Block>
            <div className={styles.confirm}>
              <Paragraph data-size="sm">
                Type <code>{item.description}</code> to confirm:
              </Paragraph>
              <Textfield
                aria-label="Type description to confirm deletion"
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
                Confirm delete
              </Button>
              <Button
                variant="secondary"
                data-size="sm"
                disabled={pending}
                onClick={onCancelDelete}
              >
                Cancel
              </Button>
            </div>
          </Card.Block>
        )}
      </article>
    </Card>
  )
}
