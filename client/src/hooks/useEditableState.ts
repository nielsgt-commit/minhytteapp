import { useCallback, useState } from "react"

export type EditableState<T> = {
  editing: boolean
  draft: T
  setDraft: (next: T) => void
  enterEdit: () => void
  cancelEdit: () => void
  save: () => Promise<void>
  isPending: boolean
}

export function useEditableState<T>({
  initial,
  onSave,
}: {
  initial: T
  onSave: (draft: T) => Promise<void> | void
}): EditableState<T> {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<T>(initial)
  const [isPending, setIsPending] = useState(false)

  const enterEdit = useCallback(() => {
    setDraft(initial)
    setEditing(true)
  }, [initial])

  const cancelEdit = useCallback(() => {
    setDraft(initial)
    setEditing(false)
  }, [initial])

  const save = useCallback(async () => {
    setIsPending(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setIsPending(false)
    }
  }, [draft, onSave])

  return { editing, draft, setDraft, enterEdit, cancelEdit, save, isPending }
}
