import { Fragment, useState } from "react"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Avatar, Card, Paragraph, Tooltip } from "@digdir/designsystemet-react"
import { ChevronDownIcon, ChevronUpIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { type SettlementPhase } from "@/features/settlement/phase"
import { selectExpensesToReview } from "@/features/expenses/selectors"
import type { ExpenseRow } from "@/features/expenses/types"
import { useTRPC } from "@/trpc/trpc"
import styles from "./SettlementHeadsProgress.module.css"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join("")
}

// The settlement phase is global, so a head's "stage" is really which
// milestone they've cleared: expenses handled → review done → split accepted.
function stageLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  phase: SettlementPhase,
  pendingExpenses: number,
  reviewDone: boolean,
  accepted: boolean,
): string {
  if (accepted) return t("Accepted")
  if (phase === "split_policy") return t("Awaiting acceptance")
  if (reviewDone) return t("Review done")
  if (phase === "reviewing") return t("Reviewing")
  if (pendingExpenses > 0) {
    return t("Expenses to review: {{count}}", {
      count: String(pendingExpenses),
    })
  }
  return t("Nothing waiting")
}

export function SettlementHeadsProgress({
  settlementId,
  phase,
}: {
  settlementId: number
  phase: SettlementPhase
}) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const [expanded, setExpanded] = useState(true)

  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  // previewSplit is the only endpoint carrying per-head review/acceptance
  // state; it can fail for non-previewable policies, so degrade to showing
  // the heads without those milestones instead of blocking the flow.
  const { data: preview } = useQuery({
    ...trpc.settlement.previewSplit.queryOptions({ id: settlementId }),
    retry: false,
  })

  const statusByHead = new Map((preview?.heads ?? []).map(h => [h.user_id, h]))
  const heads = users.filter(u => u.is_head)
  if (heads.length === 0) return null

  // Collapsed, the panel shows only the viewer's own row (nothing for a
  // non-head member); the other heads stay visible as a compact avatar
  // stack in the header until it's expanded.
  const myHead = heads.find(h => h.id === me.id)
  const orderedHeads = myHead
    ? [myHead, ...heads.filter(h => h.id !== me.id)]
    : heads
  const visibleHeads = expanded ? orderedHeads : myHead ? [myHead] : []
  const stackedHeads = orderedHeads.filter(
    h => !visibleHeads.some(v => v.id === h.id),
  )
  const canToggle = orderedHeads.length > (myHead ? 1 : 0)

  return (
    <Card asChild className={styles.tracker} data-size="sm">
      <section aria-label={t("Settlement progress")}>
        <Card.Block className={styles.block}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            disabled={!canToggle}
            onClick={() => {
              setExpanded(e => !e)
            }}
          >
            <span className={styles.heading}>{t("Settlement progress")}</span>
            {stackedHeads.length > 0 && (
              <span className={styles.stack} aria-hidden>
                {stackedHeads.map(h => (
                  <Avatar
                    key={h.id}
                    aria-hidden
                    data-initials={initials(h.name)}
                    data-size="xs"
                    className={styles.stackAvatar}
                  />
                ))}
              </span>
            )}
            {canToggle &&
              (expanded ? (
                <ChevronUpIcon aria-hidden className={styles.chevron} />
              ) : (
                <ChevronDownIcon aria-hidden className={styles.chevron} />
              ))}
          </button>
          {visibleHeads.map(head => {
            const group = groups.find(
              g => g.is_family && g.members.some(m => m.user_id === head.id),
            )
            const memberIds = new Set(group?.members.map(m => m.user_id) ?? [])
            const pendingExpenses = selectExpensesToReview(
              expenses as ExpenseRow[],
              memberIds,
              head.id,
            ).length
            const status = statusByHead.get(head.id)
            const reviewDone = status?.review_done ?? false
            const accepted = status?.accepted ?? false
            const milestones = [
              { key: "expenses", done: pendingExpenses === 0 },
              { key: "review", done: reviewDone },
              { key: "accept", done: accepted },
            ]
            const currentIndex = milestones.findIndex(m => !m.done)
            return (
              <div key={head.id} className={styles.row}>
                <Tooltip content={head.name}>
                  <Avatar
                    aria-label={head.name}
                    data-initials={initials(head.name)}
                    data-size="xs"
                    tabIndex={0}
                  />
                </Tooltip>
                <span className={styles.name}>
                  {head.id === me.id ? t("You") : head.name}
                </span>
                <span className={styles.track} aria-hidden>
                  {milestones.map((m, i) => (
                    <Fragment key={m.key}>
                      {i > 0 && <span className={styles.connector} />}
                      <span
                        className={[
                          styles.dot,
                          m.done ? styles.dotDone : "",
                          i === currentIndex ? styles.dotCurrent : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    </Fragment>
                  ))}
                </span>
                <Paragraph data-size="xs" className={styles.status}>
                  {stageLabel(t, phase, pendingExpenses, reviewDone, accepted)}
                </Paragraph>
              </div>
            )
          })}
        </Card.Block>
      </section>
    </Card>
  )
}
