import { Button, Paragraph } from "@digdir/designsystemet-react"
import { ChevronLeftIcon, ChevronRightIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./YearNavigator.module.css"

type YearNavigatorProps = {
  year: number
  onChange: (year: number) => void
}

export function YearNavigator({ year, onChange }: YearNavigatorProps) {
  const { t } = useTranslation("priority")
  return (
    <div className={styles.nav}>
      <Button
        type="button"
        variant="tertiary"
        icon
        data-size="sm"
        aria-label={t("Previous year")}
        onClick={() => {
          onChange(year - 1)
        }}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Paragraph asChild>
        <output className={styles.year}>{year}</output>
      </Paragraph>
      <Button
        type="button"
        variant="tertiary"
        icon
        data-size="sm"
        aria-label={t("Next year")}
        onClick={() => {
          onChange(year + 1)
        }}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  )
}
