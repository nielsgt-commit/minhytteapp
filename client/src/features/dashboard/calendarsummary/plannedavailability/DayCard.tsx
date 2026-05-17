import { Badge, Card } from "@digdir/designsystemet-react"
import { pad2 } from "@/utils/dateUtils"
import styles from "./PlannedAvailabilitySummary.module.css"
import GuestListView from "./GuestListView"

type Props = {
  date: Date
  weekdayLabel: string
  iso: string
  isSelected: boolean
  isToday: boolean
  hasBirthday: boolean
  count: number
  names: string[]
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
  onToggle,
}: Props) {
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
                    <strong>{weekdayLabel}</strong>{" "}
                    {pad2(date.getDate())}/{pad2(date.getMonth() + 1)}
                    {isToday && " · Today"}
                  </span>
                </Badge.Position>
              ) : (
                <span>
                  <strong>{weekdayLabel}</strong>{" "}
                  {pad2(date.getDate())}/{pad2(date.getMonth() + 1)}
                  {isToday && " · Today"}
                </span>
              )}
            </div>
            <div className={styles.dayCount}>
              {count > 0 ? (
                <strong>
                  {count} guest{count === 1 ? "" : "s"}
                </strong>
              ) : (
                <span>No guests</span>
              )}
            </div>
          </div>
          {isSelected && <GuestListView names={names} />}
        </Card.Block>
      </li>
    </Card>
  )
}
