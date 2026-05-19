import { Button, Fieldset } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

type YearNavigatorProps = {
  year: number
  onChange: (year: number) => void
}

export function YearNavigator({ year, onChange }: YearNavigatorProps) {
  const { t } = useTranslation("priority")
  return (
    <Fieldset>
      <Fieldset.Legend>{t("Year")}</Fieldset.Legend>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        onClick={() => { onChange(year - 1) }}
      >
        {t("Prev")}
      </Button>
      <output> {year} </output>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        onClick={() => { onChange(year + 1) }}
      >
        {t("Next")}
      </Button>
    </Fieldset>
  )
}
