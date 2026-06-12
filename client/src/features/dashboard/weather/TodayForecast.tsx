import { useTranslation } from "react-i18next"
import type { Temporal } from "temporal-polyfill"
import { WeatherSymbol } from "./WeatherSymbol"
import styles from "./TodayForecast.module.css"

// Property forecasts are Norwegian; bucket display by Oslo wall-clock to match
// the server's day bucketing (weather router OSLO_TZ).
const OSLO_TZ = "Europe/Oslo"

type Slot = {
  time: Temporal.Instant
  temperature_c: number
  symbol_code: string | null
}

// Each slot covers a 6-hour block aligned to the 00/06/12/18 Oslo grid; label
// it as the wall-clock range it spans, e.g. 12-18, 18-00. PlainTime.add wraps
// at midnight and ignores DST, so the label stays nominal (+6h).
function rangeLabel(time: Temporal.Instant): string {
  const start = time.toZonedDateTimeISO(OSLO_TZ).toPlainTime()
  const end = start.add({ hours: 6 })
  // PlainTime.toString() is "HH:MM:SS"; the label only wants the padded hour.
  const hh = (t: Temporal.PlainTime) => t.toString().slice(0, 2)
  return `${hh(start)}-${hh(end)}`
}

export function TodayForecast({ slots }: { slots: Slot[] }) {
  const { t } = useTranslation("dashboard")
  if (slots.length === 0) return null

  return (
    <ul className={styles.today} aria-label={t("Forecast for today")}>
      {slots.map(slot => (
        <li key={slot.time.toString()} className={styles.slot}>
          <span className={styles.time}>{rangeLabel(slot.time)}</span>
          <WeatherSymbol code={slot.symbol_code} size={18} />
          <span className={styles.temp}>{Math.round(slot.temperature_c)}°</span>
        </li>
      ))}
    </ul>
  )
}
