import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { SettlementFlow } from "@/features/settlement/SettlementFlow.tsx"
import { SettlementDashboard } from "@/features/settlement/SettlementDashboard.tsx"
import { useTRPC } from "@/trpc/trpc"

// The settlement page always lands on the dashboard. From there a head (or any
// member) steps into the phase-by-phase flow. When there is no open settlement
// there is nothing to summarise, so we go straight to the create flow.
export function SettlementHome({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const [inFlow, setInFlow] = useState(false)

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const openSettlement = settlements.find(s => s.status === "open") ?? null

  if (openSettlement == null) {
    return <SettlementFlow propertyId={propertyId} />
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
