import { Button, Card, Heading } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { Temporal } from "temporal-polyfill"
import styles from "./CreateSettlementFlow.module.css"
import { ClosedSettlementSummary } from "@/features/settlement/ClosedSettlementSummary.tsx"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"

type Status = "open" | "closed"
type Season = "winter" | "spring" | "summer" | "autumn"

export type SettlementRow = {
  id: number
  year: number
  season: Season | null
  status: Status
  split_policy: "shares" | "groups_equal" | "occupancy_days"
  split_policy_id: number | null
  closed_at: Temporal.Instant | null
}

type Props = {
  settlements: SettlementRow[]
  expandedId: number | null
  setExpandedId: (id: number | null) => void
  isHead: boolean
  pending: boolean
  onEdit: (s: SettlementRow) => void
  onDelete: (id: number) => void
}

export function ClosedSettlementsList({
  settlements,
  expandedId,
  setExpandedId,
  isHead,
  pending,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation("settlement")
  if (settlements.length === 0) {
    return <EmptyState title={t("No closed settlements yet.")} />
  }
  return (
    <ul className={styles.list}>
      {settlements.map(s => {
        const expanded = expandedId === s.id
        return (
          <li key={s.id}>
            <Card asChild>
              <article>
                <Card.Block className={styles.cardRow} data-size="sm">
                  <Heading level={4} data-size="2xs">
                    {String(s.year)}
                    {s.season != null ? ` (${s.season})` : ""}
                  </Heading>
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      data-size="sm"
                      onClick={() => {
                        setExpandedId(expanded ? null : s.id)
                      }}
                    >
                      {expanded ? t("Hide") : t("View")}
                    </Button>
                    {isHead && (
                      <>
                        <Button
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          onClick={() => {
                            onEdit(s)
                          }}
                          disabled={pending}
                        >
                          {t("Edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          onClick={() => {
                            onDelete(s.id)
                          }}
                          disabled={pending}
                        >
                          {t("Delete")}
                        </Button>
                      </>
                    )}
                  </div>
                </Card.Block>
                {expanded && (
                  <Card.Block data-size="sm">
                    <QueryBoundary>
                      <ClosedSettlementSummary settlementId={s.id} />
                    </QueryBoundary>
                  </Card.Block>
                )}
              </article>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
