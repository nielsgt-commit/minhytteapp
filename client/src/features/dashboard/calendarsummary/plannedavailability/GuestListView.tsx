import { Paragraph, Tag } from "@digdir/designsystemet-react"
import styles from "./PlannedAvailabilitySummary.module.css"

type Props = {
  names: string[]
}

export default function GuestListView({ names }: Props) {
  return (
    <div className={styles.guestList}>
      {names.length > 0 ? (
        names.map(n => (
          <Tag key={n} data-color="info">{n}</Tag>
        ))
      ) : (
        <Paragraph>No guests</Paragraph>
      )}
    </div>
  )
}
