import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { Textfield } from "@digdir/designsystemet-react"
import styles from "./InlineEditField.module.css"

type Props = {
  value: string
  onSave: (next: string) => void
  ariaLabel: string
  canEdit?: boolean
  pending?: boolean
  placeholder?: string
  multiline?: boolean
  rows?: number
  maxLength?: number
}

export function InlineEditField({
  value,
  onSave,
  ariaLabel,
  canEdit = true,
  pending = false,
  placeholder,
  multiline = false,
  rows,
  maxLength,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (!editing && restoreFocusRef.current) {
      restoreFocusRef.current = false
      triggerRef.current?.focus()
    }
  }, [editing])

  if (!canEdit) {
    return (
      <span className={styles.readOnly}>
        {value || (placeholder ? <span className={styles.placeholder}>{placeholder}</span> : null)}
      </span>
    )
  }

  if (!editing) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        disabled={pending}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || <span className={styles.placeholder}>{placeholder ?? ariaLabel}</span>}
      </button>
    )
  }

  const commit = () => {
    const next = draft.trim()
    if (next !== value.trim()) onSave(next)
    restoreFocusRef.current = true
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value)
    restoreFocusRef.current = true
    setEditing(false)
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    commit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      cancel()
      return
    }
    if (e.key === "Enter" && !multiline) {
      e.preventDefault()
      commit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft(e.target.value)
  }

  if (multiline) {
    return (
      <Textfield
        className={styles.editor}
        aria-label={ariaLabel}
        autoFocus
        multiline
        rows={rows}
        value={draft}
        maxLength={maxLength}
        disabled={pending}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    )
  }

  return (
    <Textfield
      className={styles.editor}
      aria-label={ariaLabel}
      autoFocus
      value={draft}
      maxLength={maxLength}
      disabled={pending}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
