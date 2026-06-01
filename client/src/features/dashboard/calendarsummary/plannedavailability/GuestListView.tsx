import { Tag } from "@digdir/designsystemet-react"
import styles from "./PlannedAvailabilitySummary.module.css"

type Props = {
  names: string[]
}

export default function GuestListView({ names }: Props) {
  if (names.length === 0) return null
  return (
    <div className={styles.guestList}>
      {names.map(n => (
        <Tag key={n} data-color="info">
          {n}
        </Tag>
      ))}
    </div>
  )
}
