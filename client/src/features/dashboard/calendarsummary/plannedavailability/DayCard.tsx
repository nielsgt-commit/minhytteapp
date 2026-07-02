import {
  Badge,
  Card,
  Chip,
  Divider,
  Paragraph,
  Popover,
} from "@digdir/designsystemet-react"
import { MenuElipsisHorizontalIcon } from "@navikt/aksel-icons"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { Temporal } from "temporal-polyfill"
import { formatDayMonth } from "@/utils/dateUtils"
import styles from "./PlannedAvailabilitySummary.module.css"
import { DaySummary } from "./DaySummary"
import { WeatherSymbol } from "../../weather/WeatherSymbol"
import type { RoomGroup } from "./daySummaryUtils"

type Forecast = {
  min_c: number
  max_c: number
  symbol_code: string | null
}

// Everything the per-day dinner-responsible control needs; the mutation
// plumbing stays in PlannedAvailabilitySummary so the card stays presentational.
export type DinnerControl = {
  users: { id: number; name: string }[]
  responsibleIds: number[]
  onToggle: (userId: number, next: boolean) => void
}

type WeekdayLabel = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"

type Props = {
  date: Temporal.PlainDate
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
  dinner?: DinnerControl
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
  dinner,
  onToggle,
}: Props) {
  const { t } = useTranslation("dashboard")
  const [dinnerMenuOpen, setDinnerMenuOpen] = useState(false)
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
        <Paragraph className={styles.dayLabel}>
          {hasBirthday ? (
            <Badge.Position placement="top-right">
              <Badge data-color="warning" />
              <span>
                <span className={styles.dayEmphasis}>
                  {weekdayT[weekdayLabel]}
                </span>{" "}
                {formatDayMonth(date)}
                {showTodayLabel && ` · ${t("Today")}`}
              </span>
            </Badge.Position>
          ) : (
            <span>
              <span className={styles.dayEmphasis}>
                {weekdayT[weekdayLabel]}
              </span>{" "}
              {formatDayMonth(date)}
              {showTodayLabel && ` · ${t("Today")}`}
            </span>
          )}
        </Paragraph>
        <Paragraph className={styles.dayCount}>
          {count > 0 ? (
            <span className={styles.dayEmphasis}>
              {t("{{count}} guest", { count })}
            </span>
          ) : (
            <span>{t("No guests")}</span>
          )}
        </Paragraph>
      </div>
      {forecast && (
        <Paragraph data-size="sm" className={styles.dayWeather}>
          <WeatherSymbol code={forecast.symbol_code} size={18} />
          <span>
            {Math.round(forecast.min_c)}° / {Math.round(forecast.max_c)}°
          </span>
        </Paragraph>
      )}
      {isSelected && expandInline && (
        <>
          {forecast && <Divider />}
          <DaySummary groups={groups} buildingDividers={buildingDividers} />
        </>
      )}
    </>
  )

  const dinnerNames = dinner
    ? dinner.users
        .filter(u => dinner.responsibleIds.includes(u.id))
        .map(u => u.name)
    : []

  // Own Card.Block so the checkbox dropdown never nests inside the clickable
  // (or Popover.Trigger) block above it.
  const dinnerBlock = dinner && (
    <Card.Block className={styles.dinnerBlock}>
      <div className={styles.dinnerRow}>
        <div className={styles.dinnerText}>
          <Paragraph data-size="sm" className={styles.dinnerLabel}>
            {t("Dinner")}
          </Paragraph>
          {dinnerNames.length > 0 && (
            <Paragraph
              data-size="sm"
              className={styles.dinnerNames}
              title={dinnerNames.join(", ")}
            >
              {dinnerNames.join(", ")}
            </Paragraph>
          )}
        </div>
        <Popover.TriggerContext>
          <Popover.Trigger
            variant="tertiary"
            data-size="sm"
            icon
            aria-label={t("Set dinner responsible")}
          >
            <MenuElipsisHorizontalIcon aria-hidden fontSize="1.25rem" />
          </Popover.Trigger>
          <Popover
            placement="bottom-end"
            data-color="neutral"
            className={styles.dinnerMenu}
            open={dinnerMenuOpen}
            onOpen={() => {
              setDinnerMenuOpen(true)
            }}
            onClose={() => {
              setDinnerMenuOpen(false)
            }}
          >
            <div className={styles.dinnerChips}>
              {dinner.users.map(u => (
                <Chip.Checkbox
                  key={u.id}
                  data-size="sm"
                  data-color="accent"
                  checked={dinner.responsibleIds.includes(u.id)}
                  onChange={e => {
                    dinner.onToggle(u.id, e.target.checked)
                  }}
                >
                  {u.name}
                </Chip.Checkbox>
              ))}
            </div>
          </Popover>
        </Popover.TriggerContext>
      </div>
    </Card.Block>
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
            {dinnerBlock}
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
        {dinnerBlock}
      </li>
    </Card>
  )
}
