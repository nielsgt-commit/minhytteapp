import { Button, Card, Paragraph } from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import type { SettlementPhase } from "@/features/settlement/phase.ts"

type Props = {
  phase: SettlementPhase
  stillAccepting: boolean
  next: SettlementPhase | null
  advancePending: boolean
  advanceError: { message: string } | null
  onContinue: () => void
}

export function EmptyReviewState({
  phase,
  stillAccepting,
  next,
  advancePending,
  advanceError,
  onContinue,
}: Props) {
  const { t } = useTranslation("expenses")
  if (phase !== "collecting_expenses") {
    return <EmptyState title={t("(nothing to review)")} />
  }
  return (
    <>
      <Card>{t("No more items to review.")}</Card>
      <Paragraph data-size="sm">
        <Trans
          t={t}
          i18nKey="When you're done collecting expenses, turn off <1>Accept new expenses</1> and click <3>Continue to booking days</3>."
          components={{ 1: <em />, 3: <em /> }}
        />
      </Paragraph>
      {!stillAccepting && next != null && (
        <Button
          type="button"
          data-size="sm"
          disabled={advancePending}
          onClick={onContinue}
        >
          {t("Continue to booking days")}
        </Button>
      )}
      <ErrorAlert error={advanceError} />
    </>
  )
}
