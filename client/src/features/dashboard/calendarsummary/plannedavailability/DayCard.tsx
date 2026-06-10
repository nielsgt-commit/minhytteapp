import { Badge, Card, Popover } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { pad2 } from "@/utils/dateUtils"
import styles from "./PlannedAvailabilitySummary.module.css"
import { DaySummary } from "./DaySummary"
import { WeatherSymbol } from "../../weather/WeatherSymbol"
import type { RoomGroup } from "./daySummaryUtils"

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
  groups: RoomGroup[]
  expandInline: boolean
  popover?: boolean
  buildingDividers?: boolean
  forecast?: Forecast
  onToggle: () => void
}

export function DayCard({
  date,
  weekdayLabel,
  isSelected,
  isToday,
  hasBirthday,
  count,
  groups,
  expandInline,
  popover = false,
  buildingDividers = false,
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
  const usePopover = popover && isClickable
  // In the narrow grid columns the accent "today" border is feedback enough, so the
  // "· Today" text is only shown in the wide row/inline layout (mobile and Rows view).
  const showTodayLabel = isToday && expandInline

  const cardClassName =
    [isToday && styles.dayCardToday, isSelected && styles.dayCardSelected]
      .filter(Boolean)
      .join(" ") || undefined

  const inner = (
    <>
      <div className={styles.dayRow}>
        <div className={styles.dayLabel}>
          {hasBirthday ? (
            <Badge.Position placement="top-right">
              <Badge data-color="warning" />
              <span>
                <strong>{weekdayT[weekdayLabel]}</strong> {pad2(date.getDate())}
                /{pad2(date.getMonth() + 1)}
                {showTodayLabel && ` · ${t("Today")}`}
              </span>
            </Badge.Position>
          ) : (
            <span>
              <strong>{weekdayT[weekdayLabel]}</strong> {pad2(date.getDate())}/
              {pad2(date.getMonth() + 1)}
              {showTodayLabel && ` · ${t("Today")}`}
            </span>
          )}
        </div>
        <div className={styles.dayCount}>
          {count > 0 ? (
            <strong>{t("{{count}} guest", { count })}</strong>
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
      {isSelected && expandInline && (
        <DaySummary groups={groups} buildingDividers={buildingDividers} />
      )}
    </>
  )

  // Popover mode: the card itself is the trigger; Popover.Trigger injects the
  // button role, focus and keyboard handling, so we only style the block here.
  if (usePopover) {
    return (
      <Popover.TriggerContext>
        <Card asChild className={cardClassName}>
          <li>
            <Popover.Trigger asChild>
              <Card.Block
                className={`${styles.dayCardBlock} ${styles.dayCardClickable}`}
              >
                {inner}
              </Card.Block>
            </Popover.Trigger>
            <Popover
              placement="bottom"
              data-color="neutral"
              data-overscroll="contain"
              className={styles.dayPopover}
            >
              <DaySummary groups={groups} buildingDividers={buildingDividers} />
            </Popover>
          </li>
        </Card>
      </Popover.TriggerContext>
    )
  }

  return (
    <Card asChild className={cardClassName}>
      <li>
        <Card.Block
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          aria-expanded={isClickable ? isSelected : undefined}
          onClick={isClickable ? onToggle : undefined}
          onKeyDown={
            isClickable
              ? e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onToggle()
                  }
                }
              : undefined
          }
          className={
            isClickable
              ? `${styles.dayCardBlock} ${styles.dayCardClickable}`
              : styles.dayCardBlock
          }
          style={isClickable ? undefined : { cursor: "default" }}
        >
          {inner}
        </Card.Block>
      </li>
    </Card>
  )
}
