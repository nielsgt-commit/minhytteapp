import { useState } from "react"
import { Tabs } from "@digdir/designsystemet-react"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTranslation } from "react-i18next"
import styles from "./PlanStay.module.css"
import { AddStayFlow } from "@/features/planstay/addstayflow/AddStayFlow.tsx"
import { StaySummaryCompact } from "@/features/planstay/staysummary/StaySummaryCompact.tsx"
import { PageHeader } from "@/components/shared/PageHeader"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import type { PageHelpContent } from "@/components/shared/PageHelp"

type TabValue = "overview" | "plan"

export function PlanStay() {
  const { t } = useTranslation("planstay")
  const selectedPropertyId = useSelectedPropertyId()
  const [activeTab, setActiveTab] = useState<TabValue>("overview")

  const help: PageHelpContent = {
    intro: t(
      "This is where you plan your own trips to the cabin. Pick the dates you want, say who's coming, and pick where everyone sleeps. You can also see who else has already booked the same period so you can avoid a crowd — or join in.",
    ),
    steps: [
      {
        title: t("Pick your dates"),
        body: t(
          "Choose the days you want to be at the cabin. You'll see how full the place is for those days, who else is already planning to be there, and whether any of the weeks are reserved as someone's priority week.",
        ),
      },
      {
        title: t("Say who's coming"),
        body: t(
          'Add the people joining you — other co-owners, family, and children. This is used to count beds and to show up in the "who\'s coming" lists the others see.',
        ),
      },
      {
        title: t("Choose where everyone sleeps"),
        body: t(
          "Assign your group to rooms and beds. The app warns you if a room is over capacity or already taken, so you can sort it out before you confirm.",
        ),
      },
      {
        title: t("Review and confirm"),
        body: t(
          "Check the summary, then confirm to save your stay. You can come back and edit or cancel it later if your plans change.",
        ),
      },
    ],
    connections: t(
      "Stays you plan here show up on the Dashboard calendar and in the lists of who's coming. The rooms and beds you can choose from come from the buildings set up under Manage Property → Structures. Priority weeks, when shown, are the reserved weeks managed under Manage Property.",
    ),
  }

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Plan stay")} help={help} />
        <p>
          {t(
            "Add or select a property to plan stays, block dates, and see who's booked in.",
          )}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Plan stay")} help={help} />
      <Tabs
        value={activeTab}
        onChange={value => {
          setActiveTab(value as TabValue)
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="overview">{t("Season overview")}</Tabs.Tab>
          <Tabs.Tab value="plan">{t("Pick dates")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <QueryBoundary>
            <StaySummaryCompact propertyId={selectedPropertyId} />
          </QueryBoundary>
        </Tabs.Panel>

        <Tabs.Panel value="plan">
          <div className={styles.main}>
            <QueryBoundary>
              <AddStayFlow propertyId={selectedPropertyId} />
            </QueryBoundary>
          </div>
        </Tabs.Panel>
      </Tabs>
    </section>
  )
}
