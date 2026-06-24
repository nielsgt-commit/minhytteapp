import { useSuspenseQuery, useQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Heading,
  Paragraph,
  Table,
  Tag,
  Tooltip,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import styles from "./SettlementDashboard.module.css"

type Props = {
  propertyId: number
  settlementId: number
  year: number | null
  onAdvance: () => void
}

type Contributor = {
  payer_id: number
  name: string
  count: number
  amount: number
}

// A column header that explains its numbers on hover/focus. The span is made
// focusable so keyboard users reach the tooltip, not just pointer users.
function ColHeaderTooltip({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip content={hint}>
      <span tabIndex={0} className={styles.colHeader}>
        {label}
      </span>
    </Tooltip>
  )
}

export function SettlementDashboard({
  propertyId,
  settlementId,
  year,
  onAdvance,
}: Props) {
  const { t, i18n } = useTranslation("settlement")
  const trpc = useTRPC()

  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({ property_id: propertyId }),
  )
  // The split preview only resolves for occupancy-days / custom policies; for
  // anything else the server throws, so keep it a soft (non-suspense) query and
  // degrade gracefully when it isn't available.
  const { data: preview, isPending: previewPending } = useQuery({
    ...trpc.settlement.previewSplit.queryOptions({ id: settlementId }),
    retry: false,
  })

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

  const totalReimbursed = preview?.inputs.total_reimbursed ?? null
  const totalBookingDays = preview?.inputs.total_booking_days ?? null
  // Per-group booking days only exist for occupancy-aware policies; gate the
  // column on the same signal that drives the totals tag.
  const showBookingDays = totalBookingDays != null

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <Heading level={2} data-size="sm">
            {year != null
              ? t("Settlement overview {{year}}", { year: String(year) })
              : t("Settlement overview")}
          </Heading>
          <Paragraph data-size="sm" className={styles.subtitle}>
            {t(
              "A quick look at how this period is shaping up before you step through the settlement.",
            )}
          </Paragraph>
        </div>
        <Button type="button" onClick={onAdvance}>
          {t("Advance to settlement →")}
        </Button>
      </header>

      <div className={styles.grid}>
        <Card asChild>
          <section>
            <Card.Block>
              <Heading level={3} data-size="2xs">
                {t("Top contributors")}
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

        <Card asChild>
          <section>
            <Card.Block>
              <Heading level={3} data-size="2xs">
                {t("Preliminary split")}
              </Heading>
              <Paragraph data-size="sm" className={styles.subtitle}>
                {t(
                  "An early estimate of who owes whom — final figures are set when the settlement closes.",
                )}
              </Paragraph>
            </Card.Block>
            <Card.Block>
              {previewPending ? (
                <Paragraph data-size="sm" className={styles.subtitle}>
                  {t("Calculating the preliminary split…")}
                </Paragraph>
              ) : preview == null ? (
                <Paragraph data-size="sm">
                  {t(
                    "The preliminary split isn't available for this settlement's policy yet.",
                  )}
                </Paragraph>
              ) : (
                <>
                  <div className={styles.totals}>
                    <Tag data-color="neutral" data-size="sm">
                      {t("Total reimbursed:")} {fmt(totalReimbursed ?? 0)}
                    </Tag>
                    {totalBookingDays != null && (
                      <Tag data-color="neutral" data-size="sm">
                        {t("Total booking days: {{count}}", {
                          count: totalBookingDays,
                        })}
                      </Tag>
                    )}
                  </div>
                  {preview.groups.length === 0 ? (
                    <Paragraph data-size="sm">{t("No group totals.")}</Paragraph>
                  ) : (
                    <Table data-size="sm" className={styles.table}>
                      <Table.Head>
                        <Table.Row>
                          <Table.HeaderCell scope="col">
                            {t("Group")}
                          </Table.HeaderCell>
                          {showBookingDays && (
                            <Table.HeaderCell scope="col" align="right">
                              <ColHeaderTooltip
                                label={t("Days")}
                                hint={t(
                                  "Nights this group's members stayed during the period, counted toward the split.",
                                )}
                              />
                            </Table.HeaderCell>
                          )}
                          <Table.HeaderCell scope="col" align="right">
                            <ColHeaderTooltip
                              label={t("Paid")}
                              hint={t(
                                "What this group actually paid toward the settled expenses.",
                              )}
                            />
                          </Table.HeaderCell>
                          <Table.HeaderCell scope="col" align="right">
                            <ColHeaderTooltip
                              label={t("Share")}
                              hint={t(
                                "This group's fair portion of the total under the split policy.",
                              )}
                            />
                          </Table.HeaderCell>
                          <Table.HeaderCell scope="col" align="right">
                            <ColHeaderTooltip
                              label={t("Net")}
                              hint={t(
                                "Paid minus Share. Positive means the group is owed money; negative means it owes.",
                              )}
                            />
                          </Table.HeaderCell>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        {preview.groups.map(g => (
                          <Table.Row key={g.group_id}>
                            <Table.Cell>{g.group_name}</Table.Cell>
                            {showBookingDays && (
                              <Table.Cell align="right">
                                {(g.booking_days ?? 0).toLocaleString(
                                  i18n.language,
                                )}
                              </Table.Cell>
                            )}
                            <Table.Cell align="right">
                              {fmt(g.total_paid)}
                            </Table.Cell>
                            <Table.Cell align="right">
                              {fmt(g.total_share)}
                            </Table.Cell>
                            <Table.Cell
                              align="right"
                              className={
                                g.net > 0
                                  ? styles.netPositive
                                  : g.net < 0
                                    ? styles.netNegative
                                    : undefined
                              }
                            >
                              {fmt(g.net)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                  {preview.transfers.length > 0 && (
                    <ul className={styles.transfers}>
                      {preview.transfers.map((tr, i) => (
                        <li key={i}>
                          {tr.from_group_name} → {tr.to_group_name}:{" "}
                          <strong>{fmt(tr.amount)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Card.Block>
          </section>
        </Card>
      </div>
    </div>
  )
}
