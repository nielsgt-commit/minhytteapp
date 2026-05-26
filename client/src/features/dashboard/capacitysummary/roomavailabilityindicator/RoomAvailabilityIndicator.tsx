import { Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./RoomAvailabilityIndicator.module.css"

type RoomBeds = {
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

type Room = RoomBeds & {
  structure_id: number
  structure_name?: string | null
}

function totalBeds(r: RoomBeds) {
  return (
    r.beds_sm +
    r.beds_lg +
    r.beds_double * 2 +
    r.beds_kid +
    r.mattresses +
    r.travel_cot
  )
}

function availabilityColor(
  available: number,
  total: number,
): "success" | "warning" | "danger" {
  if (available <= 1) return "danger"
  if (available < total / 2) return "warning"
  return "success"
}

export default function RoomAvailabilityIndicator({
  rooms,
}: {
  rooms: Room[]
}) {
  const { t } = useTranslation("dashboard")
  return (
    <ul className={styles.list}>
      {Array.from(
        rooms.reduce((acc, r) => {
          const prev = acc.get(r.structure_id)
          acc.set(r.structure_id, {
            name:
              r.structure_name ??
              t("Structure #{{id}}", { id: String(r.structure_id) }),
            beds: (prev?.beds ?? 0) + totalBeds(r),
          })
          return acc
        }, new Map<number, { name: string; beds: number }>()),
      ).map(([id, b]) => {
        const available = b.beds
        return (
          <Tag key={id} data-color={availabilityColor(available, b.beds)}>
            {b.name}
          </Tag>
        )
      })}
    </ul>
  )
}
