import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Props = {
  settlementId: number
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

  return (
    <section>
      <h3>
        Closed settlement: {String(data.year)}
        {data.season ? ` (${data.season})` : ""}
      </h3>
      <p>Closed at: {formatDateTime(data.closed_at)}</p>

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
