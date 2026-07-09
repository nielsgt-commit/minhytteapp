import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import styles from "./ReceiptDateButton.module.css"
import { formatDate, toDateInputValue } from "@/utils/dateUtils"

type Props = {
  value: Temporal.PlainDate
  onChange: (next: Temporal.PlainDate) => void
  disabled?: boolean
}

/**
 * "Date on receipt: 8.7.2026 (Today)" styled as a button. The real control is
 * an invisible native date input overlaying the button, so a click lands on
 * the input itself and the native picker opens.
 */
export function ReceiptDateButton({ value, onChange, disabled }: Props) {
  const { t, i18n } = useTranslation("expenses")
  const isToday = value.equals(Temporal.Now.plainDateISO())

  return (
    <span className={styles.wrapper}>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
      >
        {t("Date on receipt")}
        {": "}
        {formatDate(value, i18n.language)}
        {isToday ? ` (${t("Today")})` : ""}
      </Button>
      <input
        className={styles.overlayInput}
        type="date"
        aria-label={t("Date on receipt")}
        disabled={disabled}
        value={toDateInputValue(value)}
        onClick={e => {
          // Desktop browsers don't open the calendar when the input body is
          // clicked; the click itself grants the user activation required.
          try {
            e.currentTarget.showPicker()
          } catch {
            // Unsupported or disallowed — the input still works via keyboard.
          }
        }}
        onChange={e => {
          if (e.target.value !== "") {
            onChange(Temporal.PlainDate.from(e.target.value))
          }
        }}
      />
    </span>
  )
}
