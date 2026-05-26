import { Badge, Card } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { pad2 } from "@/utils/dateUtils"
import styles from "./PlannedAvailabilitySummary.module.css"
import GuestListView from "./GuestListView"
import WeatherSymbol from "../../weather/WeatherSymbol"

type Forecast = {
  min_c: number
  max_c: number
  symbol_code: string | null
}

type WeekdayLabel = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"

type Props = {
  date: Date
  weekdayLabel: WeekdayLabel
  iso: string
  isSelected: boolean
  isToday: boolean
  hasBirthday: boolean
  count: number
  names: string[]
  forecast?: Forecast
  onToggle: () => void
}

export default function DayCard({
  date,
  weekdayLabel,
  isSelected,
  isToday,
  hasBirthday,
  count,
  names,
  forecast,
  onToggle,
}: Props) {
  const { t } = useTranslation("dashboard")
  const weekdayT = {
    SUN: t("SUN"),
    MON: t("MON"),
    TUE: t("TUE"),
    WED: t("WED"),
    THU: t("THU"),
    FRI: t("FRI"),
    SAT: t("SAT"),
  } satisfies Record<WeekdayLabel, string>
  const isClickable = count > 0
  return (
    <Card asChild>
      <li>
        <Card.Block
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          aria-expanded={isClickable ? isSelected : undefined}
          onClick={isClickable ? onToggle : undefined}
          onKeyDown={isClickable ? e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onToggle()
            }
          } : undefined}
          className={styles.dayCardBlock}
          style={isClickable ? undefined : { cursor: "default" }}
        >
          <div className={styles.dayRow}>
            <div className={styles.dayLabel}>
              {hasBirthday ? (
                <Badge.Position placement="top-right">
                  <Badge data-color="warning" />
                  <span>
                    <strong>{weekdayT[weekdayLabel]}</strong>{" "}
                    {pad2(date.getDate())}/{pad2(date.getMonth() + 1)}
                    {isToday && ` · ${t("Today")}`}
                  </span>
                </Badge.Position>
              ) : (
                <span>
                  <strong>{weekdayT[weekdayLabel]}</strong>{" "}
                  {pad2(date.getDate())}/{pad2(date.getMonth() + 1)}
                  {isToday && ` · ${t("Today")}`}
                </span>
              )}
            </div>
            <div className={styles.dayCount}>
              {count > 0 ? (
                <strong>
                  {t("{{count}} guest", { count })}
                </strong>
              ) : (
                <span>{t("No guests")}</span>
              )}
            </div>
          </div>
          {forecast && (
            <div className={styles.dayWeather}>
              <WeatherSymbol code={forecast.symbol_code} size={18} />
              <span>
                {Math.round(forecast.min_c)}° / {Math.round(forecast.max_c)}°
              </span>
            </div>
          )}
          {isSelected && <GuestListView names={names} />}
        </Card.Block>
      </li>
    </Card>
  )
}
