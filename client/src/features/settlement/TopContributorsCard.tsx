import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import styles from "./SettlementDashboard.module.css"

type Contributor = {
  payer_id: number
  name: string
  count: number
  amount: number
}

// Who has logged the most expenses for the period, ranked by count then amount.
// Self-contained: pulls the property's expenses and scopes them to the active
// review pool itself, so it can be mounted anywhere an open settlement exists.
export function TopContributorsCard({
  propertyId,
  settlementId,
}: {
  propertyId: number
  settlementId: number
}) {
  const { t, i18n } = useTranslation("settlement")
  const trpc = useTRPC()

  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const fmt = (n: number) => `${n.toLocaleString(i18n.language)},-`
  const barWidth = (value: number, max: number) =>
    `${max > 0 ? ((value / max) * 100).toFixed(1) : "0"}%`

  // The active review pool for this period: everything submitted for review or
  // already reimbursed into this settlement. Mirrors SettlementProgressSummary.
  const inPeriod = expenses.filter(
    e => e.status === "submitted" || e.settlement_id === settlementId,
  )

  const byContributor = new Map<number, Contributor>()
  for (const e of inPeriod) {
    const prev = byContributor.get(e.payer_id) ?? {
      payer_id: e.payer_id,
      name: e.payer_name ?? t("user #{{id}}", { id: e.payer_id }),
      count: 0,
      amount: 0,
    }
    prev.count += 1
    prev.amount += e.amount
    byContributor.set(e.payer_id, prev)
  }
  const contributors = [...byContributor.values()].sort(
    (a, b) => b.count - a.count || b.amount - a.amount,
  )
  const topContributorCount = contributors[0]?.count ?? 0

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={3} data-size="2xs">
            {t("Most expenses logged")}
          </Heading>
          <Paragraph data-size="sm" className={styles.subtitle}>
            {t("Who has logged the most expenses for this period so far.")}
          </Paragraph>
        </Card.Block>
        <Card.Block>
          {contributors.length === 0 ? (
            <Paragraph data-size="sm">
              {t("No expenses submitted yet.")}
            </Paragraph>
          ) : (
            <ul className={styles.list}>
              {contributors.slice(0, 5).map(c => (
                <li key={c.payer_id} className={styles.row}>
                  <span className={styles.rowLabel}>{c.name}</span>
                  <span className={styles.bar}>
                    <span
                      className={styles.barFill}
                      style={{
                        width: barWidth(c.count, topContributorCount),
                      }}
                    />
                  </span>
                  <span className={styles.rowValue}>
                    {t("{{count}} expenses", { count: c.count })}
                    <span className={styles.muted}> · {fmt(c.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card.Block>
      </section>
    </Card>
  )
}
