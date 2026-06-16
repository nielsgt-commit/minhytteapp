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
  // When a policy splits by person-days the next phase collects booking days;
  // otherwise that phase is skipped and the head continues straight to review.
  const toBookingDays = next === "collecting_bookings"
  return (
    <>
      <Card>{t("No more items to review.")}</Card>
      <Paragraph data-size="sm">
        {toBookingDays ? (
          <Trans
            t={t}
            i18nKey="When you're done collecting expenses, turn off <1>Accept new expenses</1> and click <3>Continue to booking days</3>."
            components={{ 1: <em />, 3: <em /> }}
          />
        ) : (
          <Trans
            t={t}
            i18nKey="When you're done collecting expenses, turn off <1>Accept new expenses</1> and click <3>Continue to review settlement</3>."
            components={{ 1: <em />, 3: <em /> }}
          />
        )}
      </Paragraph>
      {!stillAccepting && next != null && (
        <Button
          type="button"
          data-size="sm"
          disabled={advancePending}
          onClick={onContinue}
        >
          {toBookingDays
            ? t("Continue to booking days")
            : t("Continue to review settlement")}
        </Button>
      )}
      <ErrorAlert error={advanceError} />
    </>
  )
}
