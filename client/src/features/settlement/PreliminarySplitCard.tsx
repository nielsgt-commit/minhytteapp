import { useQuery } from "@tanstack/react-query"
import {
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

// Preliminary split panel: an early who-owes-whom estimate for an open
// settlement. Unmounted from the dashboard for now; kept as a standalone card
// so it can be remounted wherever it makes sense later. Drop it in with
// <PreliminarySplitCard settlementId={openSettlement.id} />.
export function PreliminarySplitCard({
  settlementId,
}: {
  settlementId: number
}) {
  const { t, i18n } = useTranslation("settlement")
  const trpc = useTRPC()

  // The split preview only resolves for occupancy-days / custom policies; for
  // anything else the server throws, so keep it a soft (non-suspense) query and
  // degrade gracefully when it isn't available.
  const { data: preview, isPending: previewPending } = useQuery({
    ...trpc.settlement.previewSplit.queryOptions({ id: settlementId }),
    retry: false,
  })

  const fmt = (n: number) => `${n.toLocaleString(i18n.language)},-`

  const totalReimbursed = preview?.inputs.total_reimbursed ?? null
  const totalBookingDays = preview?.inputs.total_booking_days ?? null
  // Per-group booking days only exist for occupancy-aware policies; gate the
  // column on the same signal that drives the totals tag.
  const showBookingDays = totalBookingDays != null

  return (
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
  )
}
