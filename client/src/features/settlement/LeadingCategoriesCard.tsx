import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import styles from "./SettlementDashboard.module.css"

// Where the period's spending is going, by expense category. Self-contained:
// pulls the property's expenses and scopes them to the active review pool
// itself, so it can be mounted anywhere an open settlement exists.
export function LeadingCategoriesCard({
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

  const byCategory = new Map<string, number>()
  let uncategorized = 0
  for (const e of inPeriod) {
    if (e.expense_types.length === 0) {
      uncategorized += e.amount
      continue
    }
    for (const c of e.expense_types) {
      byCategory.set(c, (byCategory.get(c) ?? 0) + e.amount)
    }
  }
  const categories = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .concat(
      uncategorized > 0
        ? [{ name: t("(no category)"), amount: uncategorized }]
        : [],
    )
    .sort((a, b) => b.amount - a.amount)
  const topCategoryAmount = categories[0]?.amount ?? 0

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={3} data-size="2xs">
            {t("Leading categories")}
          </Heading>
          <Paragraph data-size="sm" className={styles.subtitle}>
            {t("Where the spending is going so far.")}
          </Paragraph>
        </Card.Block>
        <Card.Block>
          {categories.length === 0 ? (
            <Paragraph data-size="sm">
              {t("No expenses submitted yet.")}
            </Paragraph>
          ) : (
            <ul className={styles.list}>
              {categories.slice(0, 5).map(c => (
                <li key={c.name} className={styles.row}>
                  <span className={styles.rowLabel}>{c.name}</span>
                  <span className={styles.bar}>
                    <span
                      className={styles.barFill}
                      style={{
                        width: barWidth(c.amount, topCategoryAmount),
                      }}
                    />
                  </span>
                  <span className={styles.rowValue}>{fmt(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card.Block>
      </section>
    </Card>
  )
}
