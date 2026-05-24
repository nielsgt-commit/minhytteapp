import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"

type Props = {
  settlementId: number
}

type BuiltInPolicy = "shares" | "groups_equal" | "occupancy_days"

function formatDateTime(value: string | Date | null) {
  if (value == null) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleString()
}

export function ClosedSettlementSummary({ settlementId }: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const qc = useQueryClient()

  const BUILT_IN_LABEL: Record<BuiltInPolicy, string> = {
    occupancy_days: t("Occupancy days (built-in)"),
    groups_equal: t("Equal split between groups (built-in)"),
    shares: t("Shares (built-in)"),
  }

  const BUILT_IN_EXPLANATION: Record<BuiltInPolicy, string> = {
    occupancy_days: t(
      "Each group's share of costs is proportional to the nights they stayed during the settlement period.",
    ),
    groups_equal: t(
      "Costs are split equally between all groups, regardless of usage.",
    ),
    shares: t(
      "Costs are split between groups by their configured share weights.",
    ),
  }
  const { data } = useSuspenseQuery(
    trpc.settlement.getClosedSummary.queryOptions({ id: settlementId }),
  )
  const markTransferPaid = useMutation(
    trpc.settlement.markTransferPaid.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: trpc.settlement.getClosedSummary.queryKey(),
        })
      },
    }),
  )

  const customPolicyName = data.split_policy_name
  const policyLabel =
    data.split_policy_id != null && customPolicyName != null
      ? t("{{name}} (custom)", { name: customPolicyName })
      : BUILT_IN_LABEL[data.split_policy]
  const policyExplanation =
    data.split_policy_id != null
      ? t("Custom rule-based policy with a default rule for everything unmatched. The settlement engine currently evaluates the built-in occupancy-days split until live preview lands.")
      : BUILT_IN_EXPLANATION[data.split_policy]

  return (
    <section>
      <Heading level={3} data-size="xs">
        {t("Closed settlement: {{year}}", { year: String(data.year) })}
        {data.season ? ` (${data.season})` : ""}
      </Heading>
      <Paragraph>{t("Closed at: {{when}}", { when: formatDateTime(data.closed_at) })}</Paragraph>

      <Heading level={4} data-size="2xs">{t("Split policy")}</Heading>
      <Paragraph>
        <strong>{policyLabel}</strong>
      </Paragraph>
      <Paragraph>{policyExplanation}</Paragraph>

      <Heading level={4} data-size="2xs">{t("Per group")}</Heading>
      {data.groups.length === 0 ? (
        <Paragraph>{t("No group totals.")}</Paragraph>
      ) : (
        <table>
          <thead>
            <tr>
              <th align="left">{t("Group")}</th>
              <th align="right">{t("Paid")}</th>
              <th align="right">{t("Share")}</th>
              <th align="right">{t("Net")}</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map(g => (
              <tr key={g.user_group_id}>
                <td>{g.group_name}</td>
                <td align="right">{String(g.total_paid)},-</td>
                <td align="right">{String(g.total_share)},-</td>
                <td align="right">{String(g.net)},-</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Heading level={4} data-size="2xs">{t("Transfers")}</Heading>
      {data.transfers.length === 0 ? (
        <Paragraph>{t("No transfers.")}</Paragraph>
      ) : (
        <ul>
          {data.transfers.map(tr => (
            <li key={tr.id}>
              {tr.from_group_name} → {tr.to_group_name}:{" "}
              <strong>{String(tr.amount)},-</strong>{" "}
              {tr.status === "paid" ? (
                <span>
                  {t("(paid {{when}})", { when: tr.paid_at != null ? formatDateTime(tr.paid_at) : "" })}
                </span>
              ) : (
                <span>{t("(pending)")}</span>
              )}
              {tr.can_mark_paid && (
                <>
                  {" "}
                  <Button
                    type="button"
                    data-size="sm"
                    disabled={markTransferPaid.isPending}
                    onClick={() => {
                      markTransferPaid.mutate({ transferId: tr.id })
                    }}
                  >
                    {t("Mark paid")}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {markTransferPaid.error && (
        <p role="alert">{t("Error: {{message}}", { message: markTransferPaid.error.message })}</p>
      )}
    </section>
  )
}
