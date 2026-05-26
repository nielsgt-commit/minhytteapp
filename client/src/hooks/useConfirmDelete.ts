import { useCallback } from "react"

export function useConfirmDelete(
  message: string,
  onConfirm: () => void,
): () => void {
  return useCallback(() => {
    if (window.confirm(message)) {
      onConfirm()
    }
  }, [message, onConfirm])
}
