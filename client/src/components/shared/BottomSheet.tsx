import type { ReactNode } from "react"
import { Dialog, Heading } from "@digdir/designsystemet-react"
import styles from "./BottomSheet.module.css"

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  return (
    <Dialog
      placement="bottom"
      open={open}
      onClose={onClose}
      className={styles.sheet}
    >
      <Dialog.Block>
        <Heading level={2} data-size="sm">
          {title}
        </Heading>
      </Dialog.Block>
      <Dialog.Block>
        {/* Mounted only while open so each opening starts from fresh state. */}
        {open && children}
      </Dialog.Block>
    </Dialog>
  )
}
