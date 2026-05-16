import { type SyntheticEvent, useEffect, useMemo, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Field,
  Fieldset,
  Heading,
  Label,
  Paragraph,
  Radio,
  Select,
  Switch,
  Textarea,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./InspectionFlow.module.css"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedUserId } from "@/features/user/userSlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export type InspectionScope =
  | { kind: "structure"; id: number; name: string }
  | { kind: "infrastructure"; id: number; name: string }
  | { kind: "equipment"; id: number; name: string }

// MaintenanceScope is a subset (structure | infrastructure) — accept either via the wider type.

type Recurrence = "once" | "yearly" | "5year"
type ItemStatus = "ok" | "followup"

type ProcedureState = {
  status: ItemStatus
  description: string
}

type AdHoc = {
  key: string
  description: string
  pin: boolean
  committed: boolean
}

export function InspectionFlow(props: {
  scope: InspectionScope
  open: boolean
  onClose: () => void
}) {
  const { scope, open, onClose } = props
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedUserId = useAppSelector(selectSelectedUserId)

  const { data: maintenanceItems } = useQuery(
    trpc.maintenance.list.queryOptions(undefined, { enabled: open }),
  )
  const { data: users } = useQuery(
    trpc.user.list.queryOptions(undefined, { enabled: open }),
  )

  const currentUser = users?.find(u => u.id === selectedUserId)

  const procedureItems = useMemo(() => {
    if (!maintenanceItems) return []
    return maintenanceItems
      .filter(m => {
        if (!m.is_pinned) return false
        if (scope.kind === "structure") {
          return m.structure_id === scope.id && m.equipment_id == null
        }
        if (scope.kind === "infrastructure") return m.infrastructure_id === scope.id
        return m.equipment_id === scope.id
      })
      .slice()
      .sort((a, b) => {
        const aP = a.procedure_position ?? Number.MAX_SAFE_INTEGER
        const bP = b.procedure_position ?? Number.MAX_SAFE_INTEGER
        if (aP !== bP) return aP - bP
        const aT = new Date(a.created_at).getTime()
        const bT = new Date(b.created_at).getTime()
        return aT - bT
      })
  }, [maintenanceItems, scope])

  const [inspectedBy, setInspectedBy] = useState("")
  const [recurrence, setRecurrence] = useState<Recurrence>("yearly")
  const [notes, setNotes] = useState("")
  const [procState, setProcState] = useState<Record<number, ProcedureState>>({})
  const [adHocs, setAdHocs] = useState<AdHoc[]>([])

  useEffect(() => {
    if (open && !inspectedBy && currentUser?.name) {
      setInspectedBy(currentUser.name)
    }
  }, [open, currentUser, inspectedBy])

  const recordMutation = useMutation(
    trpc.inspection.record.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.inspection.pathKey() })
        void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
        resetForm()
        onClose()
      },
    }),
  )

  const reorderMutation = useMutation(
    trpc.maintenance.setProcedureOrder.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })
      },
    }),
  )

  const moveProcedureItem = (id: number, direction: -1 | 1) => {
    const ids = procedureItems.map(p => p.id)
    const idx = ids.indexOf(id)
    const target = idx + direction
    if (idx < 0 || target < 0 || target >= ids.length) return
    const next = ids.slice()
    next[idx] = ids[target]
    next[target] = id
    reorderMutation.mutate({ ids: next })
  }

  const resetForm = () => {
    setProcState({})
    setAdHocs([])
    setNotes("")
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const getProc = (id: number, fallback: string): ProcedureState =>
    procState[id] ?? { status: "ok", description: fallback }

  const setProc = (id: number, patch: Partial<ProcedureState>) => {
    setProcState(prev => {
      const fallback = procedureItems.find(p => p.id === id)?.description ?? ""
      const current = prev[id] ?? { status: "ok", description: fallback }
      return { ...prev, [id]: { ...current, ...patch } }
    })
  }

  const addAdHoc = () => {
    setAdHocs(prev => [
      ...prev,
      {
        key: crypto.randomUUID(),
        description: "",
        pin: false,
        committed: false,
      },
    ])
  }

  const updateAdHoc = (key: string, patch: Partial<AdHoc>) => {
    setAdHocs(prev =>
      prev.map(a => (a.key === key ? { ...a, ...patch } : a)),
    )
  }

  const removeAdHoc = (key: string) => {
    setAdHocs(prev => prev.filter(a => a.key !== key))
  }

  const commitAdHoc = (key: string) => {
    setAdHocs(prev =>
      prev.map(a =>
        a.key === key && a.description.trim().length > 0
          ? { ...a, committed: true }
          : a,
      ),
    )
  }

  const editAdHoc = (key: string) => {
    setAdHocs(prev =>
      prev.map(a => (a.key === key ? { ...a, committed: false } : a)),
    )
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedUserId == null) return
    if (!inspectedBy.trim()) return

    const procFindings = procedureItems.map(item => {
      const state = getProc(item.id, item.description)
      return {
        pinned_maintenance_id: item.id,
        description: state.description.trim() || item.description,
        pin: false,
        status: state.status,
      }
    })

    const adHocFindings = adHocs
      .filter(a => a.description.trim().length > 0)
      .map(a => ({
        description: a.description.trim(),
        pin: a.pin,
        status: "followup" as const,
      }))

    recordMutation.mutate({
      ...(scope.kind === "structure" ? { structure_id: scope.id } : {}),
      ...(scope.kind === "infrastructure" ? { infrastructure_id: scope.id } : {}),
      ...(scope.kind === "equipment" ? { equipment_id: scope.id } : {}),
      started_by_user_id: selectedUserId,
      added_by: selectedUserId,
      inspected_by: inspectedBy.trim(),
      recurrence,
      notes: notes.trim() || undefined,
      findings: [...procFindings, ...adHocFindings],
    })
  }

  const disabled = recordMutation.isPending || selectedUserId == null

  if (!open) return null

  return (
    <form onSubmit={handleSubmit} className={styles.wrap}>
      <Heading data-size="xs">Inspect {scope.name}</Heading>

      <div className={styles.section}>
        <Textfield
          label="Inspected by"
          name="inspected_by"
          value={inspectedBy}
          onChange={e => { setInspectedBy(e.target.value) }}
          required
        />
        <Field>
          <Label>Cadence</Label>
          <Select
            value={recurrence}
            onChange={e => { setRecurrence(e.target.value as Recurrence) }}
          >
            <Select.Option value="once">Once</Select.Option>
            <Select.Option value="yearly">Yearly</Select.Option>
            <Select.Option value="5year">Every 5 years</Select.Option>
          </Select>
        </Field>
      </div>

      <div className={styles.section}>
        <Heading data-size="2xs">Procedure</Heading>
        {procedureItems.length === 0 ? (
          <Paragraph data-size="sm">
            No pinned items yet. Add ad-hoc findings below and pin any that
            should recur next time.
          </Paragraph>
        ) : (
          procedureItems.map((item, idx) => {
            const state = getProc(item.id, item.description)
            const isFirst = idx === 0
            const isLast = idx === procedureItems.length - 1
            return (
              <Card key={item.id} asChild>
                <article>
                  <Card.Block>
                    <div className={styles.procHeader}>
                      <Heading
                        data-size="2xs"
                        className={styles.procTitle}
                      >
                        {item.description}
                      </Heading>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        aria-label="Move up"
                        disabled={isFirst || reorderMutation.isPending}
                        onClick={() => { moveProcedureItem(item.id, -1) }}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        aria-label="Move down"
                        disabled={isLast || reorderMutation.isPending}
                        onClick={() => { moveProcedureItem(item.id, 1) }}
                      >
                        ↓
                      </Button>
                    </div>
                    <Fieldset>
                      <Fieldset.Legend>Status</Fieldset.Legend>
                      <div className={styles.procActions}>
                        <Radio
                          label="OK"
                          name={`procedure-${String(item.id)}`}
                          value="ok"
                          checked={state.status === "ok"}
                          onChange={() => {
                            setProc(item.id, { status: "ok" })
                          }}
                        />
                        <Radio
                          label="Needs followup"
                          name={`procedure-${String(item.id)}`}
                          value="followup"
                          checked={state.status === "followup"}
                          onChange={() => {
                            setProc(item.id, { status: "followup" })
                          }}
                        />
                      </div>
                    </Fieldset>
                  </Card.Block>
                  {state.status === "followup" && (
                    <Card.Block>
                      <Textfield
                        label="Followup description"
                        value={state.description}
                        onChange={e => {
                          setProc(item.id, { description: e.target.value })
                        }}
                      />
                    </Card.Block>
                  )}
                </article>
              </Card>
            )
          })
        )}
      </div>

      <div className={styles.section}>
        <Heading data-size="2xs">Findings</Heading>
        {adHocs.map(a =>
          a.committed ? (
            <Card key={a.key} asChild>
              <article>
                <Card.Block>
                  <div className={styles.committedRow}>
                    <Paragraph
                      className={styles.committedDescription}
                      data-size="sm"
                    >
                      {a.description}
                      {a.pin ? " (pinned)" : ""}
                    </Paragraph>
                    <Button
                      variant="tertiary"
                      data-size="sm"
                      onClick={() => { editAdHoc(a.key) }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      onClick={() => { removeAdHoc(a.key) }}
                    >
                      Remove
                    </Button>
                  </div>
                </Card.Block>
              </article>
            </Card>
          ) : (
            <Card key={a.key} asChild>
              <article>
                <Card.Block>
                  <Fieldset>
                    <Fieldset.Legend>New finding</Fieldset.Legend>
                    <div className={styles.adHocRow}>
                      <div className={styles.adHocDescription}>
                        <Textfield
                          label="Description"
                          value={a.description}
                          onChange={e => {
                            updateAdHoc(a.key, { description: e.target.value })
                          }}
                        />
                      </div>
                      <Button
                        data-size="sm"
                        disabled={a.description.trim().length === 0}
                        onClick={() => { commitAdHoc(a.key) }}
                      >
                        Add
                      </Button>
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        onClick={() => { removeAdHoc(a.key) }}
                      >
                        Remove
                      </Button>
                    </div>
                    <Switch
                      label="Pin to procedure (recurs each inspection)"
                      checked={a.pin}
                      onChange={e => {
                        updateAdHoc(a.key, { pin: e.target.checked })
                      }}
                    />
                  </Fieldset>
                </Card.Block>
              </article>
            </Card>
          ),
        )}
        <Button
          variant="secondary"
          data-size="sm"
          onClick={addAdHoc}
        >
          Add finding
        </Button>
      </div>

      <Field>
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={e => { setNotes(e.target.value) }}
          rows={3}
        />
      </Field>

      {recordMutation.error && (
        <Paragraph role="alert" data-color="danger">
          {recordMutation.error.message}
        </Paragraph>
      )}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          disabled={recordMutation.isPending}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          Complete inspection
        </Button>
      </div>
    </form>
  )
}
