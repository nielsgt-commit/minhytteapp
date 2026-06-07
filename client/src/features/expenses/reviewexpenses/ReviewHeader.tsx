import { Heading, Paragraph, Switch } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ReviewExpenses.module.css"

type Props = {
  stillAccepting: boolean
  disabled: boolean
  warningCount: number | null
  onSwitchChange: (checked: boolean) => void
}

export function ReviewHeader({
  stillAccepting,
  disabled,
  warningCount,
  onSwitchChange,
}: Props) {
  const { t } = useTranslation("expenses")
  return (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm">
          1. {t("Review expenses")}
        </Heading>
        <Switch
          label={t("Accept new expenses")}
          position="end"
          data-size="sm"
          checked={stillAccepting}
          disabled={disabled}
          onChange={e => {
            onSwitchChange(e.target.checked)
          }}
        />
      </div>
      {warningCount != null && (
        <Paragraph role="alert" data-size="sm">
          {t(
            "You still have {{count}} item to review — finish the list before continuing.",
            { count: warningCount },
          )}
        </Paragraph>
      )}
    </>
  )
}
