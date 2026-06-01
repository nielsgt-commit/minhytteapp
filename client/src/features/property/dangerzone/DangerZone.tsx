import { Card, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { DeletePropertyFlow } from "./DeletePropertyFlow.tsx"

export function DangerZone() {
  const { t } = useTranslation("property")
  return (
    <Card asChild>
      <section>
        <Paragraph>
          {t(
            "Destructive actions below. These are irreversible — proceed with care.",
          )}
        </Paragraph>
        <DeletePropertyFlow />
      </section>
    </Card>
  )
}
