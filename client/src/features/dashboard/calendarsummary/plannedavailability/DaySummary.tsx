import { Divider, Paragraph, Tag } from "@digdir/designsystemet-react"
import { Fragment } from "react"
import styles from "./PlannedAvailabilitySummary.module.css"
import { GuestListView } from "./GuestListView"
import type { RoomGroup } from "./daySummaryUtils"

type Props = {
  groups: RoomGroup[]
  // Groups arrive sorted by building, so a divider before each building change
  // visually separates the buildings.
  buildingDividers?: boolean
}

// Who sleeps where on a single day, grouped by building and room.
export function DaySummary({ groups, buildingDividers = false }: Props) {
  if (groups.length === 0) return null
  return (
    <div className={styles.daySummary}>
      {groups.map((g, i) => {
        const showDivider =
          buildingDividers &&
          i > 0 &&
          g.buildingName !== groups[i - 1].buildingName
        return (
          <Fragment key={g.roomId == null ? "none" : String(g.roomId)}>
            {showDivider && <Divider />}
            <div className={styles.daySummaryGroup}>
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
          </Fragment>
        )
      })}
    </div>
  )
}
