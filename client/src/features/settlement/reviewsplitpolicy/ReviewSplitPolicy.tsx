import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card, Heading, Paragraph } from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { PREV_PHASE } from "@/features/settlement/phase"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"

type Props = {
  settlementId: number
}

export function ReviewSplitPolicy({ settlementId }: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const previewQuery = useQuery({
    ...trpc.settlement.previewSplit.queryOptions({ id: settlementId }),
    retry: false,
  })
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())

  const acceptSplit = useMutationWithInvalidation(
    trpc.settlement.acceptSplit.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const regressPhase = useMutationWithInvalidation(
    trpc.settlement.regressPhase.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const status = useMutationsStatus(acceptSplit, regressPhase)

  if (previewQuery.isPending) {
    return <CardSkeleton />
  }
  if (previewQuery.isError) {
    return (
      <Card asChild>
        <article>
          <Card.Block data-size="sm">
            <Heading level={3} data-size="xs">
              4. {t("Review split policy")}
            </Heading>
          </Card.Block>
          <Card.Block data-size="sm">
            <ErrorAlert error={previewQuery.error} />
            <Paragraph data-size="sm">
              <Trans
                ns="settlement"
                i18nKey="Update this settlement's split policy from the Settlement Test Form (only <strong>occupancy_days</strong> is implemented)."
                components={{ strong: <strong /> }}
              />
            </Paragraph>
          </Card.Block>
        </article>
      </Card>
    )
  }
  const preview = previewQuery.data
  const { inputs, groups, transfers, policy, heads, closed } = preview
  const myHead = heads.find(h => h.user_id === me.id)
  const acceptedCount = heads.filter(h => h.accepted).length

  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Heading level={3} data-size="xs">
            4. {t("Review split policy")}
          </Heading>
          <Paragraph data-size="sm">
            {t("Policy:")} <strong>{policy}</strong>
            {closed ? t(" (closed)") : ""}
          </Paragraph>
        </Card.Block>

        <Card.Block data-size="sm">
          <Paragraph data-size="sm">
            {t("Total reimbursed:")}{" "}
            <strong>{String(inputs.total_reimbursed)},-</strong>
          </Paragraph>
          <Paragraph data-size="sm">
            {t("Total booking days:")}{" "}
            <strong>{String(inputs.total_booking_days)}</strong>
          </Paragraph>
        </Card.Block>

        <Card.Block data-size="sm">
          <Heading level={4} data-size="2xs">
            {t("Per group")}
          </Heading>
          {groups.length === 0 ? (
            <Paragraph data-size="sm">{t("No groups.")}</Paragraph>
          ) : (
            <table>
              <thead>
                <tr>
                  <th align="left">{t("Group")}</th>
                  <th align="right">{t("Days")}</th>
                  <th align="right">{t("Paid")}</th>
                  <th align="right">{t("Share")}</th>
                  <th align="right">{t("Net")}</th>
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
          <Heading level={4} data-size="2xs">
            {t("Transfers")}
          </Heading>
          {transfers.length === 0 ? (
            <Paragraph data-size="sm">{t("No transfers needed.")}</Paragraph>
          ) : (
            <ul>
              {transfers.map((tr, i) => (
                <li
                  key={`${String(tr.from_group_id)}-${String(tr.to_group_id)}-${String(i)}`}
                >
                  {tr.from_group_name} → {tr.to_group_name}:{" "}
                  <strong>{String(tr.amount)},-</strong>
                </li>
              ))}
            </ul>
          )}
        </Card.Block>

        <Card.Block data-size="sm">
          <Heading level={4} data-size="2xs">
            {t("Acceptance ({{accepted}}/{{total}})", {
              accepted: String(acceptedCount),
              total: String(heads.length),
            })}
          </Heading>
          {heads.length === 0 ? (
            <Paragraph data-size="sm">{t("No heads found.")}</Paragraph>
          ) : (
            <ul>
              {heads.map(h => (
                <li key={h.user_id}>
                  {h.user_name} —{" "}
                  {h.accepted ? (
                    <strong>{t("accepted")}</strong>
                  ) : (
                    <em>{t("pending")}</em>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card.Block>

        <Card.Block data-size="sm">
          {closed ? (
            <Paragraph data-size="sm">
              <strong>{t("Settlement closed.")}</strong>
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
                {t("Back")}
              </Button>
              <Button
                type="button"
                data-size="sm"
                disabled={
                  myHead == null || myHead.accepted || acceptSplit.isPending
                }
                onClick={() => {
                  acceptSplit.mutate({ id: settlementId })
                }}
              >
                {myHead?.accepted ? t("Accepted") : t("Accept and close")}
              </Button>
            </>
          )}
          {myHead == null && !closed && (
            <Paragraph data-size="sm">
              {t("Only heads of this property can accept.")}
            </Paragraph>
          )}
          <ErrorAlert error={status.error} />
        </Card.Block>
      </article>
    </Card>
  )
}
