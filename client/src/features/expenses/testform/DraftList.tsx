import { Button } from "@digdir/designsystemet-react"
import styles from "./AddNewExpenseFlow.module.css"
import type { ExpenseDraft } from "./useExpenseDrafts.ts"

type Props = {
  drafts: ExpenseDraft[]
  total: number
  pending: boolean
  onRemove: (id: string) => void
}

export function DraftList({ drafts, total, pending, onRemove }: Props) {
  if (drafts.length === 0) return null
  return (
    <ul className={styles.draftList}>
      {drafts.map(d => (
        <li key={d.id} className={styles.draftItem}>
          <span className={styles.draftLabel}>
            {d.category} — {d.amount}
          </span>
          <Button
            type="button"
            variant="tertiary"
            data-color="danger"
            data-size="sm"
            disabled={pending}
            onClick={() => { onRemove(d.id) }}
          >
            Remove
          </Button>
        </li>
      ))}
      <li className={styles.totalRow}>
        <strong>Total</strong>
        <strong>{total}</strong>
      </li>
    </ul>
  )
}
