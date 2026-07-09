import { Divider, Paragraph } from "@digdir/designsystemet-react"
import { Fragment } from "react"
import styles from "./PlannedAvailabilitySummary.module.css"
import { GuestListView } from "./GuestListView"
import type { RoomGroup } from "./daySummaryUtils"

type Props = {
  groups: RoomGroup[]
  // Groups arrive sorted by building, so a divider before each building
  // section visually separates the buildings.
  buildingDividers?: boolean
}

type BuildingSection = {
  buildingName: string | null
  rooms: RoomGroup[]
}

// Who sleeps where on a single day: rooms and their guests nested under a
// building-name header per building.
export function DaySummary({ groups, buildingDividers = false }: Props) {
  if (groups.length === 0) return null

  // Groups arrive sorted by building then room; Map insertion order keeps
  // the sections in that order.
  const byBuilding = new Map<string | null, RoomGroup[]>()
  for (const g of groups) {
    const rooms = byBuilding.get(g.buildingName) ?? []
    rooms.push(g)
    byBuilding.set(g.buildingName, rooms)
  }
  const sections: BuildingSection[] = Array.from(
    byBuilding,
    ([buildingName, rooms]) => ({ buildingName, rooms }),
  )

  return (
    <div className={styles.daySummary}>
      {sections.map((s, i) => (
        <Fragment key={s.buildingName ?? "none"}>
          {buildingDividers && i > 0 && <Divider />}
          <div className={styles.daySummaryBuilding}>
            {s.buildingName && (
              <Paragraph
                data-size="xs"
                className={styles.daySummaryBuildingName}
              >
                {s.buildingName}
              </Paragraph>
            )}
            {s.rooms.map(g => (
              <div
                key={g.roomId == null ? "none" : String(g.roomId)}
                className={styles.daySummaryGroup}
              >
                <Paragraph data-size="sm" className={styles.daySummaryRoom}>
                  {g.roomName}
                </Paragraph>
                <GuestListView guests={g.guests} />
              </div>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
