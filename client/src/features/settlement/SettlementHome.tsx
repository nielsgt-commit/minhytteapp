import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"
import { SettlementDashboard } from "@/features/settlement/SettlementDashboard.tsx"
import { useTRPC } from "@/trpc/trpc"
import styles from "./SettlementDashboard.module.css"

// The settlement page always lands on the dashboard. From there a head (or any
// member) steps into the phase-by-phase flow. When there is no open settlement
// we still show the overview framing, with an empty state and the create action.
export function SettlementHome({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const [inFlow, setInFlow] = useState(false)

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const openSettlement = settlements.find(s => s.status === "open") ?? null

  // No open settlement: keep the overview framing and embed the create action
  // (SettlementFlow falls through to the create flow + closed-settlement list).
  if (openSettlement == null) {
    return (
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <div>
            <Heading level={2} data-size="sm">
              {t("Settlement overview")}
            </Heading>
            <Paragraph data-size="sm" className={styles.subtitle}>
              {t(
                "No settlement is open for this period yet. Start one to begin tracking expenses, stays, and the split.",
              )}
            </Paragraph>
          </div>
        </header>
        <SettlementFlow propertyId={propertyId} />
      </div>
    )
  }

  if (!inFlow) {
    return (
      <SettlementDashboard
        propertyId={propertyId}
        settlementId={openSettlement.id}
        year={openSettlement.year}
        onAdvance={() => {
          setInFlow(true)
        }}
      />
    )
  }

  return (
    <>
      <div>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={() => {
            setInFlow(false)
          }}
        >
          {t("← Back to overview")}
        </Button>
      </div>
      <SettlementFlow propertyId={propertyId} />
    </>
  )
}
