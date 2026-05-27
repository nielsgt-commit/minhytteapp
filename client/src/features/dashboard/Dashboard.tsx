import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"
import styles from "./Dashboard.module.css"
import MobileTabs from "./MobileTabs"
import PlannedStaysSection from "./PlannedStaysSection"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import PropertyEvents from "@/features/dashboard/propertyevents/PropertyEvents.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { Heading } from "@digdir/designsystemet-react"

export function Dashboard() {
  const { t } = useTranslation("dashboard")
  const selectedPropertyId = useSelectedPropertyId()
  const isMobile = useIsMobile()

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.title}>
          {t("Dashboard")}
        </Heading>
        <p>
          {t(
            "No property selected. Add or pick one from the header.",
          )}
        </p>
      </section>
    )
  }

  if (isMobile) {
    return (
      <section className={styles.page}>
        <Heading level={2} className={styles.title}>
          {t("Dashboard")}
        </Heading>
        <MobileTabs propertyId={selectedPropertyId} />
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <Heading level={2} className={styles.title}>
        {t("Dashboard")}
      </Heading>
      <CapacitySummary />
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <CalendarSummary />
      </Suspense>
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <PlannedStaysSection propertyId={selectedPropertyId} />
      </Suspense>
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <PropertyEvents />
      </Suspense>
    </section>
  )
}
