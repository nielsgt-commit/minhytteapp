import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Badge,
  Card,
  Heading,
  Paragraph,
  Tag,
} from "@digdir/designsystemet-react"
import styles from "./SettlementProgressSummary.module.css"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import {
  SETTLEMENT_PHASES,
  type SettlementPhase,
} from "@/features/settlement/phase"
import { useReviewSettlementData } from "@/features/settlement/reviewsettlement/useReviewSettlementData"
import { useTRPC } from "@/trpc/trpc"

const PHASE_LABELS: Record<SettlementPhase, string> = {
  collecting_expenses: "Collecting expenses",
  collecting_bookings: "Collecting bookings",
  reviewing: "Reviewing",
  split_policy: "Split policy",
  closed: "Closed",
}

export function SettlementProgressSummary({
  settlementId,
  phase,
}: {
  settlementId: number
  phase: SettlementPhase
}) {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const propertyId = selectedPropertyId ?? 0

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())

  const { heads, groupBookingDays } = useReviewSettlementData(settlementId)

  const openSettlement = settlements.find(s => s.id === settlementId)
  const openYear = openSettlement?.year ?? null

  const myGroup = me
    ? groups.find(
        g => g.is_main && g.members.some(m => m.user_id === me.id),
      )
    : undefined
  const myMemberIds = new Set(myGroup?.members.map(m => m.user_id) ?? [])

  const reviewCount = expenses.filter(
    e =>
      e.status === "submitted"
      && myMemberIds.has(e.payer_id)
      && e.payer_id !== me?.id,
  ).length

  const mainGroups = groups.filter(g => g.is_main)

  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Heading level={3} data-size="xs">Settlement progress</Heading>
        </Card.Block>
        <Card.Block data-size="sm">
          <Paragraph data-size="sm">
            Open settlement: <strong>{openYear ?? "—"}</strong>
          </Paragraph>
          <div className={styles.phases}>
            <Paragraph asChild data-size="sm">
              <span>Status:</span>
            </Paragraph>
            {SETTLEMENT_PHASES.map(p => (
              <Tag
                key={p}
                data-color={p === phase ? "info" : "neutral"}
                data-size="sm"
              >
                {PHASE_LABELS[p]}
              </Tag>
            ))}
          </div>
        </Card.Block>
        <Card.Block data-size="sm">
          {phase === "collecting_expenses" && (
            <Paragraph data-size="sm">
              Expenses for review: <strong>{String(reviewCount)}</strong>
            </Paragraph>
          )}
          {phase === "collecting_bookings" && (
            <Paragraph data-size="sm">
              Booking days:{" "}
              {mainGroups.map((g, i) => {
                const memberIds = new Set(g.members.map(m => m.user_id))
                return (
                  <span key={g.id}>
                    {i > 0 ? ", " : ""}
                    {g.name}{" "}
                    <strong>{String(groupBookingDays(memberIds))}</strong>
                  </span>
                )
              })}
            </Paragraph>
          )}
          {(phase === "reviewing" || phase === "split_policy") && (
            <>
              <Paragraph data-size="sm">Progress</Paragraph>
              <ul className={styles.heads}>
                {heads.map(h => (
                  <li key={h.id} className={styles.headItem}>
                    <Badge
                      data-color={
                        h.settlement_progress === "all_done"
                          ? "success"
                          : "danger"
                      }
                    />
                    <span>{h.name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card.Block>
      </article>
    </Card>
  )
}
