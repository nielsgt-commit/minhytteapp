import { useEffect } from "react"
import { createPortal } from "react-dom"
import { Alert, Paragraph } from "@digdir/designsystemet-react"
import styles from "./SelectionToast.module.css"

type Props = {
  message: string
  onDismiss: () => void
}

/**
 * Transient, self-dismissing notification rendered fixed at the bottom of the
 * viewport. Portalled to <body>: the host (the sticky header) is a stacking
 * context whose z-index sits below the floating dashboard controls, so the
 * toast's own z-index would otherwise lose to them. `onDismiss` must be stable
 * (e.g. wrapped in useCallback) so the auto-dismiss timer only resets when
 * `message` changes.
 */
export function SelectionToast({ message, onDismiss }: Props) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 3000)
    return () => {
      clearTimeout(id)
    }
  }, [message, onDismiss])

  return createPortal(
    <div className={styles.toast} role="status" aria-live="polite">
      <Alert data-color="info">
        <Paragraph>{message}</Paragraph>
      </Alert>
    </div>,
    document.body,
  )
}
