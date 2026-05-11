import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react"
import styles from "./ReviewBookingDays.module.css"
import { ReviewBookingDaysRow } from "./ReviewBookingDaysRow"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import {
  NEXT_PHASE,
  PREV_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"

type Props = {
  settlementId: number
  phase: SettlementPhase
}

function inclusiveDayCount(startIso: string, endIso: string) {
  const s = Date.parse(`${startIso}T00:00:00Z`)
  const e = Date.parse(`${endIso}T00:00:00Z`)
  return Math.round((e - s) / 86400000) + 1
}

export function ReviewBookingDays({ settlementId, phase }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [stillAccepting, setStillAccepting] = useState(true)
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
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

  const advancePhase = useMutation(
    trpc.settlement.advancePhase.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })
      },
    }),
  )

  const regressPhase = useMutation(
    trpc.settlement.regressPhase.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })
      },
    }),
  )

  const adjustmentsByBooking = new Map(
    adjustments.map(a => [a.booking_id, a]),
  )

  const allowedBookerIds = new Set<number>(
    me?.is_head
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

  const next = NEXT_PHASE.collecting_bookings
  const prev = PREV_PHASE.collecting_bookings

  return (
    <>
      <div className={styles.header}>
        <Heading level={4} data-size="sm">Review bookings</Heading>
        <Switch
          label="Accept new bookings"
          position="end"
          data-size="sm"
          checked={stillAccepting}
          disabled={advancePhase.isPending || next == null}
          onChange={e => { setStillAccepting(e.target.checked) }}
        />
      </div>
      {!stillAccepting && (
        <Paragraph role="alert" data-size="sm">
          Bookings will no longer be accepted for this period. When you&apos;re
          ready to review the settlement, click
          {" "}<em>Continue to review</em>.
        </Paragraph>
      )}
      {visible.length === 0 ? (
        <Paragraph>No bookings.</Paragraph>
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
          <strong>Total booking days: {String(total)}</strong>
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
              Back
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
                Continue to review
              </Button>
            )}
          </div>
        )}
        {advancePhase.error && (
          <p role="alert">Error: {advancePhase.error.message}</p>
        )}
        {regressPhase.error && (
          <p role="alert">Error: {regressPhase.error.message}</p>
        )}
      </div>
    </>
  )
}
