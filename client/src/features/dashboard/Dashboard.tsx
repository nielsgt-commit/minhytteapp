import { useSelectedPropertyId } from "@/selection/useSelection"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"
import styles from "./Dashboard.module.css"
import MobileTabs from "./MobileTabs"
import PlannedStaysSection from "./PlannedStaysSection"
import { CapacitySummary } from "@/features/dashboard/capacitysummary/CapacitySummary.tsx"
import CalendarSummary from "@/features/dashboard/calendarsummary/CalendarSummary.tsx"
import { useIsMobile } from "@/hooks/useIsMobile.ts"
import { PageHeader } from "@/components/shared/PageHeader"
import type { PageHelpContent } from "@/components/shared/PageHelp"

export function Dashboard() {
  const { t } = useTranslation("dashboard")
  const selectedPropertyId = useSelectedPropertyId()
  const isMobile = useIsMobile()

  const help: PageHelpContent = {
    intro: t(
      "The dashboard is the home screen for the cabin picked at the top. It gathers what's happening right now in one place: who's there, who's coming, the booking calendar, free beds and parking, the local weather, and key facts about the place.",
    ),
    connections: t(
      "Switch cabin from the menu at the top to see its dashboard. Trips you set up under Plan stay show up here in the calendar and the lists of who's coming. Costs you log under Expenses and upkeep from Maintenance also feed the numbers shown here — so the dashboard mostly mirrors what you and the others do on the other pages.",
    ),
  }

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Dashboard")} help={help} />
        <p>{t("No property selected. Add or pick one from the header.")}</p>
      </section>
    )
  }

  if (isMobile) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Dashboard")} help={help} />
        <MobileTabs propertyId={selectedPropertyId} />
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Dashboard")} help={help} />
      <CapacitySummary />
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <CalendarSummary />
      </Suspense>
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <PlannedStaysSection propertyId={selectedPropertyId} />
      </Suspense>
    </section>
  )
}
