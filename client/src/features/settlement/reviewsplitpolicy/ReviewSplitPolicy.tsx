import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { PREV_PHASE } from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"

type Props = {
  settlementId: number
}

export function ReviewSplitPolicy({ settlementId }: Props) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const previewQuery = useQuery({
    ...trpc.settlement.previewSplit.queryOptions({ id: settlementId }),
    retry: false,
  })
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())

  const acceptSplit = useMutation(
    trpc.settlement.acceptSplit.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: trpc.settlement.pathKey(),
        })
      },
    }),
  )

  const regressPhase = useMutation(
    trpc.settlement.regressPhase.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: trpc.settlement.pathKey(),
        })
      },
    }),
  )

  if (previewQuery.isPending) {
    return <Paragraph>Loading split preview…</Paragraph>
  }
  if (previewQuery.isError) {
    return (
      <Card asChild>
        <article>
          <Card.Block data-size="sm">
            <Heading level={3} data-size="xs">Review split policy</Heading>
          </Card.Block>
          <Card.Block data-size="sm">
            <Paragraph role="alert">
              Couldn&apos;t build a split preview: {previewQuery.error.message}
            </Paragraph>
            <Paragraph data-size="sm">
              Update this settlement&apos;s split policy from the Settlement
              Test Form (only <strong>occupancy_days</strong> is implemented).
            </Paragraph>
          </Card.Block>
        </article>
      </Card>
    )
  }
  const preview = previewQuery.data
  const { inputs, groups, transfers, policy, heads, closed } = preview
  const myHead = me ? heads.find(h => h.user_id === me.id) : undefined
  const acceptedCount = heads.filter(h => h.accepted).length

  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Heading level={3} data-size="xs">Review split policy</Heading>
          <Paragraph data-size="sm">
            Policy: <strong>{policy}</strong>
            {closed ? " (closed)" : ""}
          </Paragraph>
        </Card.Block>

        <Card.Block data-size="sm">
          <Paragraph data-size="sm">
            Total reimbursed:{" "}
            <strong>{String(inputs.total_reimbursed)},-</strong>
          </Paragraph>
          <Paragraph data-size="sm">
            Total booking days:{" "}
            <strong>{String(inputs.total_booking_days)}</strong>
          </Paragraph>
        </Card.Block>

        <Card.Block data-size="sm">
          <Heading level={4} data-size="2xs">Per group</Heading>
          {groups.length === 0 ? (
            <Paragraph data-size="sm">No groups.</Paragraph>
          ) : (
            <table>
              <thead>
                <tr>
                  <th align="left">Group</th>
                  <th align="right">Days</th>
                  <th align="right">Paid</th>
                  <th align="right">Share</th>
                  <th align="right">Net</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.group_id}>
                    <td>{g.group_name}</td>
                    <td align="right">{String(g.booking_days)}</td>
                    <td align="right">{String(g.total_paid)},-</td>
                    <td align="right">{String(g.total_share)},-</td>
                    <td align="right">
                      <strong>{String(g.net)},-</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card.Block>

        <Card.Block data-size="sm">
          <Heading level={4} data-size="2xs">Transfers</Heading>
          {transfers.length === 0 ? (
            <Paragraph data-size="sm">No transfers needed.</Paragraph>
          ) : (
            <ul>
              {transfers.map((t, i) => (
                <li key={`${String(t.from_group_id)}-${String(t.to_group_id)}-${String(i)}`}>
                  {t.from_group_name} → {t.to_group_name}:{" "}
                  <strong>{String(t.amount)},-</strong>
                </li>
              ))}
            </ul>
          )}
        </Card.Block>

        <Card.Block data-size="sm">
          <Heading level={4} data-size="2xs">
            Acceptance ({String(acceptedCount)}/{String(heads.length)})
          </Heading>
          {heads.length === 0 ? (
            <Paragraph data-size="sm">No heads found.</Paragraph>
          ) : (
            <ul>
              {heads.map(h => (
                <li key={h.user_id}>
                  {h.user_name} —{" "}
                  {h.accepted ? (
                    <strong>accepted</strong>
                  ) : (
                    <em>pending</em>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card.Block>

        <Card.Block data-size="sm">
          {closed ? (
            <Paragraph data-size="sm">
              <strong>Settlement closed.</strong>
            </Paragraph>
          ) : (
            <>
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                disabled={regressPhase.isPending}
                onClick={() => {
                  const prev = PREV_PHASE.split_policy
                  if (prev == null) return
                  regressPhase.mutate({
                    id: settlementId,
                    from: "split_policy",
                    to: prev,
                  })
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                data-size="sm"
                disabled={
                  myHead == null
                  || myHead.accepted
                  || acceptSplit.isPending
                }
                onClick={() => {
                  acceptSplit.mutate({ id: settlementId })
                }}
              >
                {myHead?.accepted ? "Accepted" : "Accept and close"}
              </Button>
            </>
          )}
          {myHead == null && !closed && (
            <Paragraph data-size="sm">
              Only heads of this property can accept.
            </Paragraph>
          )}
          {acceptSplit.error && (
            <p role="alert">Error: {acceptSplit.error.message}</p>
          )}
          {regressPhase.error && (
            <p role="alert">Error: {regressPhase.error.message}</p>
          )}
        </Card.Block>
      </article>
    </Card>
  )
}
