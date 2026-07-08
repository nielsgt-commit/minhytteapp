import { useRef } from "react"
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
 * "Date on receipt: 8.7.2026 (Today)" rendered as a button that opens the
 * native date picker. Stands in for the receipt-upload controls for now.
 */
export function ReceiptDateButton({ value, onChange, disabled }: Props) {
  const { t, i18n } = useTranslation("expenses")
  const inputRef = useRef<HTMLInputElement>(null)
  const isToday = value.equals(Temporal.Now.plainDateISO())

  const openPicker = () => {
    const input = inputRef.current
    if (!input) return
    if (typeof input.showPicker === "function") {
      input.showPicker()
    } else {
      input.click()
    }
  }

  return (
    <span className={styles.wrapper}>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        disabled={disabled}
        onClick={openPicker}
      >
        {t("Date on receipt")}
        {": "}
        {formatDate(value, i18n.language)}
        {isToday ? ` (${t("Today")})` : ""}
      </Button>
      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={toDateInputValue(value)}
        onChange={e => {
          if (e.target.value !== "") {
            onChange(Temporal.PlainDate.from(e.target.value))
          }
        }}
      />
    </span>
  )
}
