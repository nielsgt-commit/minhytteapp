import { Skeleton } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./CardSkeleton.module.css"

type Props = {
  lines?: number
}

// Loading placeholder sized for a dashboard card: a title line plus `lines`
// body lines.
export function CardSkeleton({ lines = 3 }: Props) {
  const { t } = useTranslation("shared")
  return (
    <div className={styles.card} aria-busy="true" aria-label={t("Loading")}>
      <Skeleton variant="text" width="40%" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" width="100%" />
      ))}
    </div>
  )
}
