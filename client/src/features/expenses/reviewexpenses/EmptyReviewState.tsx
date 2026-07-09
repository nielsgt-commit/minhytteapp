import { useState } from "react"
import {
  Button,
  Card,
  Dialog,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ReviewExpenses.module.css"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import type { SettlementPhase } from "@/features/settlement/phase.ts"

type Props = {
  phase: SettlementPhase
  next: SettlementPhase | null
  advancePending: boolean
  advanceError: { message: string } | null
  onContinue: () => void
}

export function EmptyReviewState({
  phase,
  next,
  advancePending,
  advanceError,
  onContinue,
}: Props) {
  const { t } = useTranslation("expenses")
  const [confirming, setConfirming] = useState(false)
  if (phase !== "collecting_expenses") {
    return <EmptyState title={t("(nothing to review)")} />
  }
  // When a policy splits by person-days the next phase collects booking days;
  // otherwise that phase is skipped and the head continues straight to review.
  const toBookingDays = next === "collecting_bookings"
  return (
    <>
      <Card>{t("No more items to review.")}</Card>
      {next != null && (
        <>
          <div>
            <Button
              type="button"
              data-size="sm"
              onClick={() => {
                setConfirming(true)
              }}
            >
              {toBookingDays
                ? t("Continue to booking days")
                : t("Continue to review settlement")}
            </Button>
          </div>
          <Dialog
            open={confirming}
            onClose={() => {
              setConfirming(false)
            }}
          >
            <Dialog.Block>
              <Heading level={3} data-size="xs">
                {t("Close expenses?")}
              </Heading>
            </Dialog.Block>
            <Dialog.Block>
              <Paragraph data-size="sm">
                {t(
                  "Continuing closes expense logging for this period — no new expenses can be added to the settlement. If something turns up later, it can be reopened with the Back button on the next step.",
                )}
              </Paragraph>
            </Dialog.Block>
            <Dialog.Block>
              <div className={styles.confirmActions}>
                <Button
                  type="button"
                  variant="tertiary"
                  data-size="sm"
                  disabled={advancePending}
                  onClick={() => {
                    setConfirming(false)
                  }}
                >
                  {t("Cancel")}
                </Button>
                <Button
                  type="button"
                  data-size="sm"
                  disabled={advancePending}
                  onClick={onContinue}
                >
                  {t("Close expenses and continue")}
                </Button>
              </div>
              <ErrorAlert error={advanceError} />
            </Dialog.Block>
          </Dialog>
        </>
      )}
      {!confirming && <ErrorAlert error={advanceError} />}
    </>
  )
}
