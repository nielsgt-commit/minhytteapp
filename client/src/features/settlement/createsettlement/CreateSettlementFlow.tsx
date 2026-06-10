import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Card } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  ClosedSettlementsList,
  type SettlementRow,
} from "./ClosedSettlementsList"
import { SettlementForm, type EditTarget } from "./SettlementForm"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"

type Props = { propertyId: number; isHead: boolean }

export function CreateSettlementFlow({ propertyId, isHead }: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const [openBlock, setOpenBlock] = useState<"form" | "closed" | null>(null)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const closedSettlements = settlements
    .filter(s => s.status === "closed")
    .sort((a, b) => {
      const aClosed = a.closed_at ? new Date(a.closed_at).getTime() : 0
      const bClosed = b.closed_at ? new Date(b.closed_at).getTime() : 0
      if (aClosed !== bClosed) return bClosed - aClosed
      return b.year - a.year
    })

  const closeForm = () => {
    setOpenBlock(null)
    setEditing(null)
  }

  const createMutation = useMutationWithInvalidation(
    trpc.settlement.create.mutationOptions({ onSuccess: closeForm }),
    [trpc.settlement.pathKey()],
  )

  const updateMutation = useMutationWithInvalidation(
    trpc.settlement.update.mutationOptions({ onSuccess: closeForm }),
    [trpc.settlement.pathKey()],
  )

  const deleteMutation = useMutationWithInvalidation(
    trpc.settlement.delete.mutationOptions(),
    [trpc.settlement.pathKey()],
  )

  const status = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
  )

  const handleSubmit = (values: {
    year: number
    splitPolicyId: number | null
  }) => {
    const base = {
      property_id: propertyId,
      year: values.year,
      status: editing?.status ?? ("open" as const),
      split_policy: "occupancy_days" as const,
      split_policy_id: values.splitPolicyId,
    }
    const payload =
      editing?.season != null ? { ...base, season: editing.season } : base
    if (editing == null) {
      createMutation.mutate(payload)
    } else {
      updateMutation.mutate({ id: editing.id, ...payload })
    }
  }

  const startEditing = (s: SettlementRow) => {
    setEditing({
      id: s.id,
      status: s.status,
      season: s.season,
      year: s.year,
      splitPolicyId: s.split_policy_id,
    })
    setOpenBlock("form")
  }

  return (
    <>
      {isHead && (
        <Card asChild>
          <article>
            <Card.Block data-size="sm">
              {openBlock === "form" ? (
                <QueryBoundary>
                  <SettlementForm
                    key={editing?.id ?? "new"}
                    propertyId={propertyId}
                    editing={editing}
                    pending={status.pending}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                  />
                </QueryBoundary>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  data-size="sm"
                  onClick={() => {
                    setOpenBlock("form")
                  }}
                >
                  {editing == null
                    ? t("Start the settlement…")
                    : t("Edit settlement #{{id}}", { id: String(editing.id) })}
                </Button>
              )}
            </Card.Block>
          </article>
        </Card>
      )}
      <Card asChild>
        <article>
          <Card.Block data-size="sm">
            <Button
              type="button"
              variant={openBlock === "closed" ? "secondary" : "tertiary"}
              data-size="sm"
              onClick={() => {
                setOpenBlock(openBlock === "closed" ? null : "closed")
              }}
            >
              {openBlock === "closed"
                ? t("Hide closed settlements")
                : t("Show closed settlements")}
            </Button>
            {openBlock === "closed" && (
              <ClosedSettlementsList
                settlements={closedSettlements}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                isHead={isHead}
                pending={status.pending}
                onEdit={startEditing}
                onDelete={id => {
                  deleteMutation.mutate({ id })
                }}
              />
            )}
          </Card.Block>
        </article>
      </Card>
      <ErrorAlert error={status.error} />
    </>
  )
}
