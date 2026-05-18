import { Button, Card, Paragraph } from "@digdir/designsystemet-react"
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
  if (phase !== "collecting_expenses") {
    return <p>(nothing to review)</p>
  }
  return (
    <>
      <Card>No more items to review.</Card>
      <Paragraph data-size="sm">
        When you&apos;re done collecting expenses, turn off
        {" "}<em>Accept new expenses</em> and click
        {" "}<em>Continue to booking days</em>.
      </Paragraph>
      {!stillAccepting && next != null && (
        <Button
          type="button"
          data-size="sm"
          disabled={advancePending}
          onClick={onContinue}
        >
          Continue to booking days
        </Button>
      )}
      {advanceError && (
        <p role="alert">Error: {advanceError.message}</p>
      )}
    </>
  )
}
