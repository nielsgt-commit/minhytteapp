import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTranslation } from "react-i18next"
import styles from "./Maintenance.module.css"
import { StructureStats } from "@/features/maintenance/structure/StructureStats.tsx"
import { PageHeader } from "@/components/shared/PageHeader"
import type { PageHelpContent } from "@/components/shared/PageHelp"

export function Maintenance() {
  const { t } = useTranslation("maintenance")
  const selectedPropertyId = useSelectedPropertyId()

  const help: PageHelpContent = {
    intro: t(
      "Maintenance is where you keep track of looking after the cabin: log things that need doing, plan and follow up the work, run inspections, and look back at what's been done. It's organised in three tabs — Structures (the buildings), Infrastructure (things like the water supply, road or septic system) and Equipment.",
    ),
    steps: [
      {
        title: t("Pick a tab and open an item"),
        body: t(
          "Choose Structures, Infrastructure or Equipment, then find the building, system or piece of equipment you want to work on. Each one has its own card.",
        ),
      },
      {
        title: t("Log a task"),
        body: t(
          "Open the todos on a card and add what needs doing. You can set how serious it is and when it's due, so everyone can see what's coming up.",
        ),
      },
      {
        title: t("Do the work and mark it done"),
        body: t(
          "When a task is finished, mark it Done. It then moves into the history for that item.",
        ),
      },
      {
        title: t("Run an inspection"),
        body: t(
          "Start an inspection to walk through your check list, note any findings, and record who inspected it. The inspection is saved to the history too.",
        ),
      },
    ],
    connections: t(
      "The Structures, Infrastructure and Equipment shown here are set up under Manage Property. A short summary of upcoming and recent upkeep can also appear on the Dashboard, so the others can see how the cabin is being looked after.",
    ),
  }

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Maintenance")} help={help} />
        <p>
          {t(
            "Add or select a property to log issues, plan upkeep, and track work across Structures.",
          )}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Maintenance")} help={help} />
      <StructureStats />
    </section>
  )
}
