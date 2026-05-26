import { Paragraph, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./PlannedAvailabilitySummary.module.css"

type Props = {
  names: string[]
}

export default function GuestListView({ names }: Props) {
  const { t } = useTranslation("dashboard")
  return (
    <div className={styles.guestList}>
      {names.length > 0 ? (
        names.map(n => (
          <Tag key={n} data-color="info">
            {n}
          </Tag>
        ))
      ) : (
        <Paragraph>{t("No guests")}</Paragraph>
      )}
    </div>
  )
}
