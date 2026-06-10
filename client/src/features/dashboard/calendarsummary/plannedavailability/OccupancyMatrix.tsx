import { Fragment } from "react"
import { useTranslation } from "react-i18next"
import { Table } from "@digdir/designsystemet-react"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { pad2, toIso } from "@/utils/dateUtils"
import styles from "./OccupancyMatrix.module.css"

const WEEKDAY_LABELS = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const

type Occupant = {
  room_id: number | null
  user_id: number
  user_name: string | null
}

type Booking = {
  status: string
  start_date: string
  end_date: string
  occupants: Occupant[]
}

type Room = {
  id: number
  name: string
  structure_id: number
  structure_name: string
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

type Props = {
  days: Date[]
  bookings: readonly Booking[]
  rooms: readonly Room[]
}

type Bar = {
  userId: number
  name: string
  startCol: number
  endCol: number
  lane: number
}

const UNASSIGNED = "none"

function roomCapacity(r: Room): number {
  return (
    r.beds_sm +
    r.beds_lg +
    r.beds_double * 2 +
    r.beds_kid +
    r.mattresses +
    r.travel_cot
  )
}

// Greedy interval partitioning: pack non-overlapping bars onto the same lane,
// then return one array of bars per lane (each sorted by start column).
function laneArraysFor(input: Omit<Bar, "lane">[]): Bar[][] {
  const sorted = [...input].sort(
    (a, b) => a.startCol - b.startCol || a.endCol - b.endCol,
  )
  const laneEnds: number[] = []
  const lanes: Bar[][] = []
  for (const bar of sorted) {
    let lane = laneEnds.findIndex(end => end < bar.startCol)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(bar.endCol)
      lanes.push([])
    } else {
      laneEnds[lane] = bar.endCol
    }
    lanes[lane].push({ ...bar, lane })
  }
  return lanes.length > 0 ? lanes : [[]]
}

// occupants / beds → a faint-to-strong accent tint (never fully opaque, so it
// reads as a fill level). The exact count stays available via the cell title.
function densityStyle(ratio: number): { backgroundColor?: string } {
  if (ratio <= 0) return {}
  const pct = Math.round(15 + Math.min(1, ratio) * 70)
  return {
    backgroundColor: `color-mix(in srgb, var(--ds-color-accent-base-default) ${String(pct)}%, transparent)`,
  }
}

export function OccupancyMatrix({ days, bookings, rooms }: Props) {
  const { t } = useTranslation("dashboard")
  const weekIsos = days.map(toIso)
  const wStart = weekIsos[0]
  const wEnd = weekIsos[6]
  const todayIso = toIso(new Date())

  const roomById = new Map(rooms.map(r => [r.id, r]))

  // Per-room stay bars and per-room/day occupant sets, clipped to the week.
  const barsByRoom = new Map<string, Omit<Bar, "lane">[]>()
  const dayUsersByRoom = new Map<string, Set<number>[]>()

  for (const b of bookings) {
    if (b.status === "cancelled") continue
    if (b.start_date > wEnd || b.end_date < wStart) continue
    const s = b.start_date < wStart ? wStart : b.start_date
    const e = b.end_date > wEnd ? wEnd : b.end_date
    const startCol = weekIsos.indexOf(s)
    const endCol = weekIsos.indexOf(e)
    if (startCol === -1 || endCol === -1) continue
    for (const o of b.occupants) {
      const key = o.room_id == null ? UNASSIGNED : String(o.room_id)
      const name = o.user_name ?? `#${String(o.user_id)}`
      const bars = barsByRoom.get(key) ?? []
      bars.push({ userId: o.user_id, name, startCol, endCol })
      barsByRoom.set(key, bars)

      const sets =
        dayUsersByRoom.get(key) ??
        Array.from({ length: 7 }, () => new Set<number>())
      for (let c = startCol; c <= endCol; c++) sets[c].add(o.user_id)
      dayUsersByRoom.set(key, sets)
    }
  }

  const roomDayCount = (key: string, col: number) =>
    dayUsersByRoom.get(key)?.[col].size ?? 0

  // Group occupied rooms under their building; unassigned occupants go last.
  type Building = {
    id: number | null
    name: string
    beds: number
    roomKeys: string[]
  }
  const buildings = new Map<string, Building>()

  const bedsByStructure = new Map<number, number>()
  for (const r of rooms) {
    bedsByStructure.set(
      r.structure_id,
      (bedsByStructure.get(r.structure_id) ?? 0) + roomCapacity(r),
    )
  }

  for (const key of barsByRoom.keys()) {
    if (key === UNASSIGNED) {
      const b = buildings.get(UNASSIGNED) ?? {
        id: null,
        name: t("Unassigned room"),
        beds: 0,
        roomKeys: [],
      }
      b.roomKeys.push(key)
      buildings.set(UNASSIGNED, b)
      continue
    }
    const room = roomById.get(Number(key))
    if (!room) continue
    const bid = String(room.structure_id)
    const b = buildings.get(bid) ?? {
      id: room.structure_id,
      name: room.structure_name,
      beds: bedsByStructure.get(room.structure_id) ?? 0,
      roomKeys: [],
    }
    b.roomKeys.push(key)
    buildings.set(bid, b)
  }

  const orderedBuildings = Array.from(buildings.values()).sort((a, b) => {
    if (a.id == null) return 1
    if (b.id == null) return -1
    return a.name.localeCompare(b.name)
  })
  for (const b of orderedBuildings) {
    b.roomKeys.sort((x, y) => {
      const rx = roomById.get(Number(x))?.name ?? ""
      const ry = roomById.get(Number(y))?.name ?? ""
      return rx.localeCompare(ry)
    })
  }

  if (barsByRoom.size === 0) {
    return <EmptyState title={t("No stays this week.")} />
  }

  // Tile a lane's 7 day columns: a bar becomes one colSpan cell, gaps are empties.
  const renderLane = (laneBars: Bar[]) => {
    const cells = []
    let col = 0
    while (col < 7) {
      const bar = laneBars.find(b => b.startCol === col)
      if (bar) {
        const span = bar.endCol - bar.startCol + 1
        cells.push(
          <Table.Cell key={col} colSpan={span} className={styles.barCell}>
            <span className={styles.bar} title={bar.name}>
              {bar.name}
            </span>
          </Table.Cell>,
        )
        col += span
      } else {
        cells.push(<Table.Cell key={col} />)
        col += 1
      }
    }
    return cells
  }

  return (
    <div className={styles.scroll}>
      <Table border data-size="sm" className={styles.matrix}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell />
            {days.map((d, i) => (
              <Table.HeaderCell
                key={weekIsos[i]}
                className={`${styles.dayHead} ${
                  weekIsos[i] === todayIso ? styles.dayHeadToday : ""
                }`}
              >
                {t(WEEKDAY_LABELS[d.getDay()])}
                <span className={styles.dayHeadDate}>
                  {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                </span>
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {orderedBuildings.map(building => (
            <Fragment key={building.id ?? UNASSIGNED}>
              <Table.Row>
                <Table.HeaderCell scope="row" className={styles.buildingName}>
                  {building.name}
                </Table.HeaderCell>
                {days.map((_, col) => {
                  const count = building.roomKeys.reduce(
                    (sum, key) => sum + roomDayCount(key, col),
                    0,
                  )
                  const ratio = building.beds > 0 ? count / building.beds : 0
                  return (
                    <Table.Cell
                      key={col}
                      style={densityStyle(ratio)}
                      title={
                        building.beds > 0
                          ? `${String(count)} / ${String(building.beds)}`
                          : String(count)
                      }
                    />
                  )
                })}
              </Table.Row>
              {building.roomKeys.map(key => {
                const room =
                  key === UNASSIGNED ? null : roomById.get(Number(key))
                const lanes = laneArraysFor(barsByRoom.get(key) ?? [])
                return lanes.map((laneBars, laneIdx) => (
                  <Table.Row key={`${key}-${String(laneIdx)}`}>
                    {laneIdx === 0 && (
                      <Table.HeaderCell
                        scope="row"
                        rowSpan={lanes.length}
                        className={styles.roomLabel}
                      >
                        {room ? room.name : t("Unassigned room")}
                      </Table.HeaderCell>
                    )}
                    {renderLane(laneBars)}
                  </Table.Row>
                ))
              })}
            </Fragment>
          ))}
        </Table.Body>
      </Table>
    </div>
  )
}
