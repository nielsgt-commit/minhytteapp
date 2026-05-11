import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { ReviewBookingDays } from "./ReviewBookingDays"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import {
  NEXT_PHASE,
  PREV_PHASE,
  type SettlementPhase,
} from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"

function inclusiveDayCount(startIso: string, endIso: string) {
  const s = Date.parse(`${startIso}T00:00:00Z`)
  const e = Date.parse(`${endIso}T00:00:00Z`)
  return Math.round((e - s) / 86400000) + 1
}

type Props = {
  settlementId: number
  phase: SettlementPhase
}

export function BookingDaySummary({ settlementId, phase }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const propertyId = selectedPropertyId ?? 0
  const [showDetails, setShowDetails] = useState(false)

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

  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
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

  const total = bookings
    .filter(
      b =>
        b.status !== "cancelled"
        && allowedBookerIds.has(b.booker_id)
        && !(adjustmentsByBooking.get(b.id)?.excluded ?? false),
    )
    .reduce((sum, b) => {
      const occupantHits = b.occupants.filter(o =>
        allowedBookerIds.has(o.user_id),
      ).length
      const extras = adjustmentsByBooking.get(b.id)?.extra_names ?? []
      const headcount = occupantHits + extras.length
      return sum + headcount * inclusiveDayCount(b.start_date, b.end_date)
    }, 0)

  return (
    <Card asChild style={{ border: "none" }}>
      <article>
        <Card.Block>
          <Heading level={3} data-size="xs">Booking days</Heading>
        </Card.Block>
        <Card.Block>
          <Paragraph>
            <strong>Total booking days: {String(total)}</strong>
          </Paragraph>
          <Button
            type="button"
            variant="secondary"
            data-size="sm"
            onClick={() => { setShowDetails(s => !s) }}
          >
            Details
          </Button>
          {phase === "collecting_bookings" && (
            <>
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                disabled={regressPhase.isPending}
                onClick={() => {
                  const prev = PREV_PHASE.collecting_bookings
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
              <Button
                type="button"
                data-size="sm"
                disabled={advancePhase.isPending}
                onClick={() => {
                  const next = NEXT_PHASE.collecting_bookings
                  if (next == null) return
                  advancePhase.mutate({
                    id: settlementId,
                    from: "collecting_bookings",
                    to: next,
                  })
                }}
              >
                Close and progress to settlement
              </Button>
            </>
          )}
          {advancePhase.error && (
            <p role="alert">Error: {advancePhase.error.message}</p>
          )}
          {regressPhase.error && (
            <p role="alert">Error: {regressPhase.error.message}</p>
          )}
        </Card.Block>
        {showDetails && (
          <Card.Block>
            <ReviewBookingDays settlementId={settlementId} />
          </Card.Block>
        )}
      </article>
    </Card>
  )
}
