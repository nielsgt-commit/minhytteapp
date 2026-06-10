import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTranslation } from "react-i18next"
import styles from "./Settlement.module.css"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"
import { PageHeader } from "@/components/shared/PageHeader"
import type { PageHelpContent } from "@/components/shared/PageHelp"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"

export function Settlement() {
  const { t } = useTranslation("settlement")
  const selectedPropertyId = useSelectedPropertyId()

  const help: PageHelpContent = {
    intro: t(
      "Settlement is where the co-owners square up shared costs for a period. It gathers everyone's expenses and stays, splits the total fairly, and works out who owes whom before the books are closed.",
    ),
    steps: [
      {
        title: t("Expenses"),
        body: t(
          "Go through the shared expenses logged for the period and make sure they all belong here and the amounts are right.",
        ),
      },
      {
        title: t("Stays"),
        body: t(
          "Check how many nights each household stayed. The nights each household spent decide how much of the total they carry.",
        ),
      },
      {
        title: t("Reviewing"),
        body: t(
          "Each household head goes over the figures and ticks off when they're happy. Everyone has to be done before the settlement can move on.",
        ),
      },
      {
        title: t("Split policy"),
        body: t(
          "See the total split between the households by how much each used the cabin, with the exact transfers needed to even things out. Each head accepts the result.",
        ),
      },
      {
        title: t("Close"),
        body: t(
          "Once everyone has accepted, the settlement is closed and the agreed amounts are settled up between the households.",
        ),
      },
    ],
    connections: [
      t(
        "A settlement pulls together two things for the period: the approved expenses from the Expenses page and how many nights each household stayed (from the trips planned under Plan stay). It then splits the total between the households by how many nights each stayed, and works out who pays whom.",
      ),
      t(
        "Every household has a head, and admins act as heads too. Any member can start a settlement, but the heads are the ones who run it — only a head can approve or reject the submitted expenses, mark a review as done, and accept the final split. Each head works on their own household's figures; other households' details stay hidden until that head chooses to show them.",
      ),
      t(
        "Regular members can open this page and follow along to see how the period is shaping up, but the action buttons are reserved for the heads. Every head has to finish their review and accept the split before it can move on.",
      ),
      t(
        "Once all the heads accept, the settlement is closed and the transfers between households become final. Earlier closed settlements stay available here to look back on.",
      ),
    ],
  }

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Settlement")} help={help} />
        <EmptyState
          title={t(
            "Add or select a property to balance expenses and settle up.",
          )}
        />
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Settlement")} help={help} />
      <QueryBoundary>
        <SettlementFlow propertyId={selectedPropertyId} />
      </QueryBoundary>
    </section>
  )
}
