import { Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./PlannedAvailabilitySummary.module.css"
import type { GuestChip } from "./daySummaryUtils"

export function GuestListView({ guests }: { guests: GuestChip[] }) {
  const { t } = useTranslation("dashboard")
  if (guests.length === 0) return null
  return (
    <div className={styles.guestList}>
      {guests.map(g => (
        <Tag key={g.name} data-color={g.queued ? "neutral" : "info"}>
          {g.name}
          {g.pending && "?"}
          {g.queued && t(" (queued)")}
        </Tag>
      ))}
    </div>
  )
}
