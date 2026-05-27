import { Card, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { DeletePropertyFlow } from "./DeletePropertyFlow.tsx"

export function DangerZone() {
  const { t } = useTranslation("property")
  return (
    <Card asChild>
      <section>
        <Heading level={3}>{t("Danger zone")}</Heading>
        <p>
          {t(
            "Destructive actions below. These are irreversible — proceed with care.",
          )}
        </p>
        <DeletePropertyFlow />
      </section>
    </Card>
  )
}
