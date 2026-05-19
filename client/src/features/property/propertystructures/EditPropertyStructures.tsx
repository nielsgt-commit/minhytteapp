import { Card } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

export default function PropertyStructures() {
  const { t } = useTranslation("property")
  return (
    <Card>
      <Card.Block>
        <h1>{t("Property Structures")}</h1>
        <p> {t("Structure names")} </p>
      </Card.Block>
    </Card>
  )
}
