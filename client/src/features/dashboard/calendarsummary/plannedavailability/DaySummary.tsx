import { Paragraph, Tag } from "@digdir/designsystemet-react"
import styles from "./PlannedAvailabilitySummary.module.css"
import GuestListView from "./GuestListView"
import type { RoomGroup } from "./daySummaryUtils"

type Props = {
  groups: RoomGroup[]
}

// Who sleeps where on a single day, grouped by building and room.
export default function DaySummary({ groups }: Props) {
  if (groups.length === 0) return null
  return (
    <div className={styles.daySummary}>
      {groups.map(g => (
        <div
          key={g.roomId == null ? "none" : String(g.roomId)}
          className={styles.daySummaryGroup}
        >
          <div className={styles.daySummaryWhere}>
            <Paragraph data-size="sm" className={styles.daySummaryRoom}>
              {g.roomName}
            </Paragraph>
            {g.buildingName && (
              <Tag data-size="sm" data-color="neutral">
                {g.buildingName}
              </Tag>
            )}
          </div>
          <GuestListView names={g.guests} />
        </div>
      ))}
    </div>
  )
}
