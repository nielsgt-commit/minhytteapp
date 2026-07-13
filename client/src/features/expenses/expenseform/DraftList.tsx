import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./AddNewExpenseFlow.module.css"
import type { ExpenseDraft } from "./useExpenseDrafts.ts"

type Props = {
  drafts: ExpenseDraft[]
  preview: { category: string; amount: string } | null
  total: number
  pending: boolean
  onRemove: (id: string) => void
}

export function DraftList({
  drafts,
  preview,
  total,
  pending,
  onRemove,
}: Props) {
  const { t } = useTranslation("expenses")
  return (
    <ul className={styles.draftList}>
      {drafts.length === 0 && preview == null && (
        <li className={styles.emptyHint}>
          {t("Add one or more expenses below, press Submit when you are done.")}
        </li>
      )}
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
            onClick={() => {
              onRemove(d.id)
            }}
          >
            {t("Remove")}
          </Button>
        </li>
      ))}
      {preview != null && (
        <li className={styles.previewItem}>
          {preview.category} — {preview.amount === "" ? "…" : preview.amount}
        </li>
      )}
      <li className={styles.totalRow}>
        <strong>{t("Total")}</strong>
        <strong>{total}</strong>
      </li>
    </ul>
  )
}
