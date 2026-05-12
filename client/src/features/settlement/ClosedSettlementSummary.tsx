import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Props = {
  settlementId: number
}

type BuiltInPolicy = "shares" | "groups_equal" | "occupancy_days"

const BUILT_IN_LABEL: Record<BuiltInPolicy, string> = {
  occupancy_days: "Occupancy days (built-in)",
  groups_equal: "Equal split between groups (built-in)",
  shares: "Shares (built-in)",
}

const BUILT_IN_EXPLANATION: Record<BuiltInPolicy, string> = {
  occupancy_days:
    "Each group's share of costs is proportional to the nights they stayed during the settlement period.",
  groups_equal:
    "Costs are split equally between all groups, regardless of usage.",
  shares:
    "Costs are split between groups by their configured share weights.",
}

function formatDateTime(value: string | Date | null) {
  if (value == null) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleString()
}

export function ClosedSettlementSummary({ settlementId }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
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
      ? `${customPolicyName} (custom)`
      : BUILT_IN_LABEL[data.split_policy]
  const policyExplanation =
    data.split_policy_id != null
      ? "Custom rule-based policy with a default rule for everything unmatched. The settlement engine currently evaluates the built-in occupancy-days split until live preview lands."
      : BUILT_IN_EXPLANATION[data.split_policy]

  return (
    <section>
      <h3>
        Closed settlement: {String(data.year)}
        {data.season ? ` (${data.season})` : ""}
      </h3>
      <p>Closed at: {formatDateTime(data.closed_at)}</p>

      <h4>Split policy</h4>
      <p>
        <strong>{policyLabel}</strong>
      </p>
      <p>{policyExplanation}</p>

      <h4>Per group</h4>
      {data.groups.length === 0 ? (
        <p>No group totals.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th align="left">Group</th>
              <th align="right">Paid</th>
              <th align="right">Share</th>
              <th align="right">Net</th>
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

      <h4>Transfers</h4>
      {data.transfers.length === 0 ? (
        <p>No transfers.</p>
      ) : (
        <ul>
          {data.transfers.map(t => (
            <li key={t.id}>
              {t.from_group_name} → {t.to_group_name}:{" "}
              <strong>{String(t.amount)},-</strong>{" "}
              {t.status === "paid" ? (
                <span>
                  (paid{" "}
                  {t.paid_at != null ? formatDateTime(t.paid_at) : ""})
                </span>
              ) : (
                <span>(pending)</span>
              )}
              {t.can_mark_paid && (
                <>
                  {" "}
                  <button
                    type="button"
                    disabled={markTransferPaid.isPending}
                    onClick={() => {
                      markTransferPaid.mutate({ transferId: t.id })
                    }}
                  >
                    Mark paid
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {markTransferPaid.error && (
        <p role="alert">Error: {markTransferPaid.error.message}</p>
      )}
    </section>
  )
}
