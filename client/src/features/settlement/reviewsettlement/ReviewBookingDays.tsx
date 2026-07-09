import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import styles from "./ReviewBookingDays.module.css"
import { ReviewBookingDaysRow } from "./ReviewBookingDaysRow"
import { type SettlementPhase } from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { inclusiveDayCount } from "@/utils/dateUtils"

type Props = {
  settlementId: number
  phase: SettlementPhase
  next: SettlementPhase | null
  prev: SettlementPhase | null
  stepNumber: number
}

export function ReviewBookingDays({
  settlementId,
  phase,
  next,
  prev,
  stepNumber,
}: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const [stillAccepting, setStillAccepting] = useState(true)
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: adjustments } = useSuspenseQuery(
    trpc.settlement.getBookingAdjustments.queryOptions({ settlementId }),
  )

  const advancePhase = useMutationWithInvalidation(
    trpc.settlement.advancePhase.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const regressPhase = useMutationWithInvalidation(
    trpc.settlement.regressPhase.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const status = useMutationsStatus(advancePhase, regressPhase)

  const adjustmentsByBooking = new Map(adjustments.map(a => [a.booking_id, a]))

  const iAmHead = me.head_property_ids.includes(propertyId)
  const allowedBookerIds = new Set<number>(
    iAmHead
      ? groups
          .filter(g => g.members.some(m => m.user_id === me.id))
          .flatMap(g => g.members.map(m => m.user_id))
      : [],
  )

  const visible = bookings.filter(
    b => b.status !== "cancelled" && allowedBookerIds.has(b.booker_id),
  )

  const total = visible
    .filter(b => !(adjustmentsByBooking.get(b.id)?.excluded ?? false))
    .reduce((sum, b) => {
      const occupantHits = b.occupants.filter(o =>
        allowedBookerIds.has(o.user_id),
      ).length
      const extras = adjustmentsByBooking.get(b.id)?.extra_names ?? []
      const headcount = occupantHits + extras.length
      return sum + headcount * inclusiveDayCount(b.start_date, b.end_date)
    }, 0)

  return (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm">
          {String(stepNumber)}. {t("Review bookings")}
        </Heading>
        <Switch
          label={t("Accept new bookings")}
          position="end"
          data-size="sm"
          checked={stillAccepting}
          disabled={advancePhase.isPending || next == null}
          onChange={e => {
            setStillAccepting(e.target.checked)
          }}
        />
      </div>
      <Paragraph data-size="sm">
        {t(
          "This is where you review your family group's bookings for the period. The booking days decide how the total is split between the households, so make sure the days and guests are right.",
        )}
      </Paragraph>
      {!stillAccepting && (
        <Paragraph role="alert" data-size="sm">
          <Trans
            ns="settlement"
            i18nKey="Bookings will no longer be accepted for this period. When you're ready to review the settlement, click <em>Continue to review</em>."
            components={{ em: <em /> }}
          />
        </Paragraph>
      )}
      {visible.length === 0 ? (
        <EmptyState title={t("No bookings.")} />
      ) : (
        <div className={styles.list}>
          {visible.map(b => {
            const a = adjustmentsByBooking.get(b.id)
            return (
              <ReviewBookingDaysRow
                key={b.id}
                settlementId={settlementId}
                booking={b}
                users={users}
                excluded={a?.excluded ?? false}
                extras={a?.extra_names ?? []}
              />
            )
          })}
        </div>
      )}
      <div className={styles.footer}>
        <Paragraph data-size="sm">
          <strong>
            {t("Total booking days: {{count}}", { count: total })}
          </strong>
        </Paragraph>
        {phase === "collecting_bookings" && (
          <div className={styles.footerActions}>
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={regressPhase.isPending || prev == null}
              onClick={() => {
                if (prev == null) return
                regressPhase.mutate({
                  id: settlementId,
                  from: "collecting_bookings",
                  to: prev,
                })
              }}
            >
              {t("Back")}
            </Button>
            {!stillAccepting && next != null && (
              <Button
                type="button"
                data-size="sm"
                disabled={advancePhase.isPending}
                onClick={() => {
                  advancePhase.mutate({
                    id: settlementId,
                    from: "collecting_bookings",
                    to: next,
                  })
                }}
              >
                {t("Continue to review")}
              </Button>
            )}
          </div>
        )}
        <ErrorAlert error={status.error} />
      </div>
    </>
  )
}
