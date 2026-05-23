import { type ReactNode, useEffect, useRef } from "react"
import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./InlineEditRow.module.css"

type Props = {
  editing: boolean
  canEdit: boolean
  editLabel: string
  onStartEdit: () => void
  view: ReactNode
  form: ReactNode
  actions?: ReactNode
  pending?: boolean
}

export function InlineEditRow({
  editing,
  canEdit,
  editLabel,
  onStartEdit,
  view,
  form,
  actions,
  pending = false,
}: Props) {
  const { t } = useTranslation("common")
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditingRef = useRef(editing)

  useEffect(() => {
    if (wasEditingRef.current && !editing) editButtonRef.current?.focus()
    wasEditingRef.current = editing
  }, [editing])

  if (editing) return <>{form}</>

  return (
    <>
      {view}
      {canEdit && (
        <div className={styles.actions}>
          <Button
            ref={editButtonRef}
            variant="tertiary"
            data-size="sm"
            disabled={pending}
            aria-label={editLabel}
            onClick={onStartEdit}
          >
            {t("Edit")}
          </Button>
          {actions}
        </div>
      )}
    </>
  )
}
