import { Button } from "@digdir/designsystemet-react"
import styles from "./AddNewExpenseFlow.module.css"

type Props = {
  pending: boolean
  onCancel: () => void
}

export function SubmitRow({ pending, onCancel }: Props) {
  return (
    <div className={styles.submitRow}>
      <Button type="submit" disabled={pending}>
        Submit
      </Button>
      <Button
        type="button"
        variant="tertiary"
        onClick={onCancel}
        disabled={pending}
      >
        Cancel
      </Button>
    </div>
  )
}
