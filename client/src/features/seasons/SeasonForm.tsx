import { useState } from "react"
import {
  Button,
  Fieldset,
  Paragraph,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { formatDateRange } from "@/utils/dateUtils"
import {
  type Season,
  seasonInstanceYear,
  seasonWindow,
} from "@/utils/seasonUtils"
import styles from "./SeasonForm.module.css"

export type SeasonFormValues = {
  name: string
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  priority_weeks: number[]
}

type Props = {
  legend: string
  submitLabel: string
  initial?: SeasonFormValues
  pending: boolean
  onSubmit: (values: SeasonFormValues) => Promise<void>
  onCancel: () => void
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

// "28, 29, 30" → [28, 29, 30]; null when any token is not a week number.
function parseWeeks(raw: string): number[] | null {
  const tokens = raw
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
  const weeks: number[] = []
  for (const token of tokens) {
    const n = Number(token)
    if (!Number.isInteger(n) || n < 1 || n > 53) return null
    weeks.push(n)
  }
  return [...new Set(weeks)].sort((a, b) => a - b)
}

export function SeasonForm({
  legend,
  submitLabel,
  initial,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const { t, i18n } = useTranslation("property")

  const [name, setName] = useState(initial?.name ?? "")
  const [startMonth, setStartMonth] = useState(initial?.start_month ?? 6)
  const [startDay, setStartDay] = useState(String(initial?.start_day ?? 1))
  const [endMonth, setEndMonth] = useState(initial?.end_month ?? 8)
  const [endDay, setEndDay] = useState(String(initial?.end_day ?? 31))
  const [weeksRaw, setWeeksRaw] = useState(
    initial ? initial.priority_weeks.join(", ") : "",
  )

  const monthName = (m: number) =>
    Temporal.PlainDate.from({ year: 2000, month: m, day: 1 }).toLocaleString(
      i18n.language,
      { month: "long" },
    )

  const weeks = parseWeeks(weeksRaw)
  const startDayNum = Number(startDay)
  const endDayNum = Number(endDay)
  const daysValid =
    Number.isInteger(startDayNum) &&
    startDayNum >= 1 &&
    startDayNum <= 31 &&
    Number.isInteger(endDayNum) &&
    endDayNum >= 1 &&
    endDayNum <= 31

  // Live preview of the concrete dates for the current-or-next instance, so
  // configuring a cross-year season (Dec–Feb) is self-explanatory.
  let preview: string | null = null
  if (daysValid) {
    const draft: Season = {
      id: null,
      name,
      start_month: startMonth,
      start_day: startDayNum,
      end_month: endMonth,
      end_day: endDayNum,
      priority_weeks: weeks ?? [],
    }
    const today = Temporal.Now.plainDateISO()
    const window = seasonWindow(draft, seasonInstanceYear(draft, today))
    preview = formatDateRange(
      window.start,
      window.end.subtract({ days: 1 }),
      i18n.language,
    )
  }

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed || !daysValid || weeks == null) return
    await onSubmit({
      name: trimmed,
      start_month: startMonth,
      start_day: startDayNum,
      end_month: endMonth,
      end_day: endDayNum,
      priority_weeks: weeks,
    })
  }

  return (
    <form action={handleSubmit} className={styles.form}>
      <Fieldset>
        <Fieldset.Legend>{legend}</Fieldset.Legend>
        <Textfield
          label={t("Season name")}
          value={name}
          required
          autoFocus
          maxLength={64}
          disabled={pending}
          onChange={e => {
            setName(e.target.value)
          }}
        />
        <div className={styles.rangeRow}>
          <Select
            data-size="sm"
            aria-label={t("Start month")}
            value={String(startMonth)}
            disabled={pending}
            onChange={e => {
              setStartMonth(Number(e.target.value))
            }}
          >
            {MONTHS.map(m => (
              <Select.Option key={m} value={String(m)}>
                {monthName(m)}
              </Select.Option>
            ))}
          </Select>
          <Textfield
            aria-label={t("Start day")}
            value={startDay}
            type="number"
            min={1}
            max={31}
            required
            data-size="sm"
            className={styles.dayField}
            disabled={pending}
            error={
              startDay !== "" && !(startDayNum >= 1 && startDayNum <= 31)
                ? t("Day must be between 1 and 31")
                : undefined
            }
            onChange={e => {
              setStartDay(e.target.value)
            }}
          />
          <span className={styles.rangeDash}>–</span>
          <Select
            data-size="sm"
            aria-label={t("End month")}
            value={String(endMonth)}
            disabled={pending}
            onChange={e => {
              setEndMonth(Number(e.target.value))
            }}
          >
            {MONTHS.map(m => (
              <Select.Option key={m} value={String(m)}>
                {monthName(m)}
              </Select.Option>
            ))}
          </Select>
          <Textfield
            aria-label={t("End day")}
            value={endDay}
            type="number"
            min={1}
            max={31}
            required
            data-size="sm"
            className={styles.dayField}
            disabled={pending}
            error={
              endDay !== "" && !(endDayNum >= 1 && endDayNum <= 31)
                ? t("Day must be between 1 and 31")
                : undefined
            }
            onChange={e => {
              setEndDay(e.target.value)
            }}
          />
        </div>
        {preview && (
          <Paragraph data-size="sm" className={styles.preview}>
            {t("Next occurrence: {{range}}", { range: preview })}
          </Paragraph>
        )}
        <Textfield
          label={t("Priority weeks (ISO week numbers, comma-separated)")}
          value={weeksRaw}
          placeholder="28, 29, 30"
          disabled={pending}
          error={
            weeks == null ? t("Weeks must be numbers from 1 to 53") : undefined
          }
          onChange={e => {
            setWeeksRaw(e.target.value)
          }}
        />
        <div className={styles.actions}>
          <SubmitButton disabled={pending || weeks == null || !daysValid}>
            {submitLabel}
          </SubmitButton>
          <Button
            type="button"
            variant="tertiary"
            disabled={pending}
            onClick={onCancel}
          >
            {t("Cancel")}
          </Button>
        </div>
      </Fieldset>
    </form>
  )
}
