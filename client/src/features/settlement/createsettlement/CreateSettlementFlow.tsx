import { type SyntheticEvent, Suspense, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Paragraph,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./CreateSettlementFlow.module.css"
import { ClosedSettlementSummary } from "@/features/settlement/ClosedSettlementSummary.tsx"
import { SplitPolicyBuilder } from "@/features/settlement/splitpolicybuilder/SplitPolicyBuilder.tsx"
import { useTRPC } from "@/trpc/trpc"

type Status = "open" | "closed"
type Season = "winter" | "spring" | "summer" | "autumn"

type SettlementRow = {
  id: number
  year: number
  season: Season | null
  status: Status
  split_policy: "shares" | "groups_equal" | "occupancy_days"
  split_policy_id: number | null
  closed_at: string | Date | null
}

type EditTarget = {
  id: number
  status: Status
  season: Season | null
}

type Props = { propertyId: number; isHead: boolean }

export function CreateSettlementFlow({ propertyId, isHead }: Props) {
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
                <Suspense fallback={<p>Loading form…</p>}>
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
                    ? "Start the settlement…"
                    : `Edit settlement #${String(editing.id)}`}
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
                ? "Hide closed settlements"
                : "Show closed settlements"}
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
      {lastError && <p role="alert">Error: {lastError.message}</p>}
    </>
  )
}

type SettlementFormProps = {
  propertyId: number
  year: string
  setYear: (v: string) => void
  splitPolicyId: string
  setSplitPolicyId: (v: string) => void
  editing: EditTarget | null
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
  builderOpen: boolean
  onToggleBuilder: () => void
  onBuilderSaved: (policyId: number) => void
}

function SettlementForm({
  propertyId,
  year,
  setYear,
  splitPolicyId,
  setSplitPolicyId,
  editing,
  pending,
  onSubmit,
  onCancel,
  builderOpen,
  onToggleBuilder,
  onBuilderSaved,
}: SettlementFormProps) {
  const trpc = useTRPC()
  const { data: customPolicies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  return (
    <form onSubmit={onSubmit}>
      <div className={styles.formRow}>
        <Textfield
          label="Year"
          type="number"
          value={year}
          onChange={e => { setYear(e.target.value) }}
          required
        />
        <Field>
          <Label>Split policy</Label>
          <Select
            value={splitPolicyId}
            onChange={e => { setSplitPolicyId(e.target.value) }}
          >
            <Select.Option value="">Occupancy days (built-in)</Select.Option>
            {customPolicies.map(p => (
              <Select.Option key={p.id} value={String(p.id)}>
                {p.name} (by {p.created_by_name ?? `#${String(p.created_by_id)}`})
              </Select.Option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={onToggleBuilder}
        >
          {builderOpen ? "Close split policy builder" : "Add split policy"}
        </Button>
        <Button type="submit" disabled={pending}>
          {editing == null
            ? "Create and start settlement"
            : `Update settlement #${String(editing.id)}`}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {builderOpen && (
        <Suspense fallback={<p>Loading split policy builder…</p>}>
          <SplitPolicyBuilder onSaved={onBuilderSaved} />
        </Suspense>
      )}
    </form>
  )
}

type ClosedSettlementsListProps = {
  settlements: SettlementRow[]
  expandedId: number | null
  setExpandedId: (id: number | null) => void
  isHead: boolean
  pending: boolean
  onEdit: (s: SettlementRow) => void
  onDelete: (id: number) => void
}

function ClosedSettlementsList({
  settlements,
  expandedId,
  setExpandedId,
  isHead,
  pending,
  onEdit,
  onDelete,
}: ClosedSettlementsListProps) {
  if (settlements.length === 0) {
    return <Paragraph data-size="sm">No closed settlements yet.</Paragraph>
  }
  return (
    <ul className={styles.list}>
      {settlements.map(s => {
        const expanded = expandedId === s.id
        return (
          <li key={s.id}>
            <Card asChild>
              <article>
                <Card.Block className={styles.cardRow} data-size="sm">
                  <Heading level={4} data-size="2xs">
                    {String(s.year)}
                    {s.season != null ? ` (${s.season})` : ""}
                  </Heading>
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      data-size="sm"
                      onClick={() => {
                        setExpandedId(expanded ? null : s.id)
                      }}
                    >
                      {expanded ? "Hide" : "View"}
                    </Button>
                    {isHead && (
                      <>
                        <Button
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          onClick={() => { onEdit(s) }}
                          disabled={pending}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          onClick={() => { onDelete(s.id) }}
                          disabled={pending}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </Card.Block>
                {expanded && (
                  <Card.Block data-size="sm">
                    <Suspense fallback={<p>Loading closed settlement…</p>}>
                      <ClosedSettlementSummary settlementId={s.id} />
                    </Suspense>
                  </Card.Block>
                )}
              </article>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
