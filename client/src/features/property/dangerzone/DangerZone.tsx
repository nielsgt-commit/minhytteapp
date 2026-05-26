import { Card } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { DeletePropertyFlow } from "./DeletePropertyFlow.tsx"
import { WipeDbFlow } from "./WipeDbFlow.tsx"

export function DangerZone() {
  const { t } = useTranslation("property")
  return (
    <Card asChild>
      <section>
        <h3>{t("Danger zone")}</h3>
        <p>
          {t(
            "Destructive actions below. These are irreversible — proceed with care.",
          )}
        </p>
        <DeletePropertyFlow />
        <WipeDbFlow />
      </section>
    </Card>
  )
}
