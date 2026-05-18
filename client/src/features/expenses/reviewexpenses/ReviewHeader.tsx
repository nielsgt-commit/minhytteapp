import { Heading, Paragraph, Switch } from "@digdir/designsystemet-react"
import styles from "./ReviewExpenses.module.css"

type Props = {
  stillAccepting: boolean
  disabled: boolean
  switchWarning: string | null
  onSwitchChange: (checked: boolean) => void
}

export function ReviewHeader({
  stillAccepting,
  disabled,
  switchWarning,
  onSwitchChange,
}: Props) {
  return (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm">Review expenses</Heading>
        <Switch
          label="Accept new expenses"
          position="end"
          data-size="sm"
          checked={stillAccepting}
          disabled={disabled}
          onChange={e => { onSwitchChange(e.target.checked) }}
        />
      </div>
      {switchWarning && (
        <Paragraph role="alert" data-size="sm">{switchWarning}</Paragraph>
      )}
    </>
  )
}
