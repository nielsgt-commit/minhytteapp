import { type SyntheticEvent, Suspense, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Card } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { ClosedSettlementsList, type SettlementRow } from "./ClosedSettlementsList"
import { SettlementForm } from "./SettlementForm"
import { useTRPC } from "@/trpc/trpc"

type Status = "open" | "closed"
type Season = "winter" | "spring" | "summer" | "autumn"

type EditTarget = {
  id: number
  status: Status
  season: Season | null
}

type Props = { propertyId: number; isHead: boolean }

export function CreateSettlementFlow({ propertyId, isHead }: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const [openBlock, setOpenBlock] = useState<"form" | "closed" | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [splitPolicyId, setSplitPolicyId] = useState("")
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

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })

  const resetForm = () => {
    setYear(String(new Date().getFullYear()))
    setSplitPolicyId("")
    setEditing(null)
  }

  const createMutation = useMutation(
    trpc.settlement.create.mutationOptions({
      onSuccess: () => {
        resetForm()
        setOpenBlock(null)
        setBuilderOpen(false)
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.settlement.update.mutationOptions({
      onSuccess: () => {
        resetForm()
        setOpenBlock(null)
        setBuilderOpen(false)
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.settlement.delete.mutationOptions({
      onSuccess: () => { void invalidate() },
    }),
  )

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending
  const lastError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const base = {
      property_id: propertyId,
      year: Number(year),
      status: editing?.status ?? ("open" as const),
      split_policy: "occupancy_days" as const,
      split_policy_id: splitPolicyId === "" ? null : Number(splitPolicyId),
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
    setEditing({ id: s.id, status: s.status, season: s.season })
    setYear(String(s.year))
    setSplitPolicyId(s.split_policy_id == null ? "" : String(s.split_policy_id))
    setBuilderOpen(false)
    setOpenBlock("form")
  }

  return (
    <>
      {isHead && (
        <Card asChild>
          <article>
            <Card.Block data-size="sm">
              {openBlock === "form" ? (
                <Suspense fallback={<p>{t("Loading form…")}</p>}>
                  <SettlementForm
                    propertyId={propertyId}
                    year={year}
                    setYear={setYear}
                    splitPolicyId={splitPolicyId}
                    setSplitPolicyId={setSplitPolicyId}
                    editing={editing}
                    pending={pending}
                    onSubmit={handleSubmit}
                    onCancel={() => {
                      setOpenBlock(null)
                      resetForm()
                      setBuilderOpen(false)
                    }}
                    builderOpen={builderOpen}
                    onToggleBuilder={() => { setBuilderOpen(v => !v) }}
                    onBuilderSaved={id => {
                      setSplitPolicyId(String(id))
                      setBuilderOpen(false)
                    }}
                  />
                </Suspense>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  data-size="sm"
                  onClick={() => { setOpenBlock("form") }}
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
                pending={pending}
                onEdit={startEditing}
                onDelete={id => { deleteMutation.mutate({ id }) }}
              />
            )}
          </Card.Block>
        </article>
      </Card>
      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}
    </>
  )
}
