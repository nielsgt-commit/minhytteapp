import { Button, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { TopContributorsCard } from "@/features/settlement/TopContributorsCard.tsx"
import { LeadingCategoriesCard } from "@/features/settlement/LeadingCategoriesCard.tsx"
import styles from "./SettlementDashboard.module.css"

type Props = {
  propertyId: number
  settlementId: number
  year: number | null
  onAdvance: () => void
}

export function SettlementDashboard({
  propertyId,
  settlementId,
  year,
  onAdvance,
}: Props) {
  const { t } = useTranslation("settlement")

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <Heading level={2} data-size="sm">
            {year != null
              ? t("Settlement overview {{year}}", { year: String(year) })
              : t("Settlement overview")}
          </Heading>
          <Paragraph data-size="sm" className={styles.subtitle}>
            {t(
              "A quick look at how this period is shaping up before you step through the settlement.",
            )}
          </Paragraph>
        </div>
        <Button type="button" onClick={onAdvance}>
          {t("Advance to settlement →")}
        </Button>
      </header>

      <div className={styles.grid}>
        <TopContributorsCard
          propertyId={propertyId}
          settlementId={settlementId}
        />
        <LeadingCategoriesCard
          propertyId={propertyId}
          settlementId={settlementId}
        />
      </div>
    </div>
  )
}
