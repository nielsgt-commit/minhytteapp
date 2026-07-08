import {
  useSelectedPropertyId,
  useSelectedUserId,
} from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button, Field, Label } from "@digdir/designsystemet-react"
import type { PortableTextBlock } from "@portabletext/types"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import styles from "./InspectionFlow.module.css"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { isoWeekYear, startOfSunday } from "@/utils/dateUtils"
import {
  FindingsSection,
  type AdHoc,
} from "@/features/maintenance/inspectionflow/FindingsSection.tsx"
import { MetadataSection } from "@/features/maintenance/inspectionflow/MetadataSection.tsx"
import type { PriorityOwner } from "@/features/maintenance/due/MaintenanceDueSelect.tsx"
import type { CadenceSelection } from "@/features/maintenance/inspectionflow/inspectionCadence.ts"
import {
  ProcedureSection,
  type NewStep,
  type ProcedureItem,
  type ProcedureState,
} from "@/features/maintenance/inspectionflow/ProcedureSection.tsx"
import { MaintenanceInstructionsPTEditor } from "@/features/maintenance/maintenancecard/MaintenanceInstructionsPTEditor.tsx"
import { useTRPC } from "@/trpc/trpc.ts"

export type InspectionScope =
  | { kind: "structure"; id: number; name: string }
  | { kind: "infrastructure"; id: number; name: string }
  | { kind: "equipment"; id: number; name: string }

// MaintenanceScope is a subset (building | infrastructure) — accept either via the wider type.

export function InspectionFlow(props: {
  scope: InspectionScope
  open: boolean
  onClose: () => void
}) {
  const { scope, open, onClose } = props
  const trpc = useTRPC()
  const selectedUserId = useSelectedUserId()
  const selectedPropertyId = useSelectedPropertyId()

  const { data: procedureSteps } = useQuery(
    trpc.procedureStep.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: open && selectedPropertyId != null },
    ),
  )
  const { data: users } = useQuery(
    trpc.user.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: open && selectedPropertyId != null },
    ),
  )
  // Family groups eligible for a priority-week cadence. Shares its cache key
  // with MaintenanceTodos' priority query (same refYear); only eligibleOwners
  // is consumed here.
  const priorityYear = isoWeekYear(
    startOfSunday(Temporal.Now.plainDateISO()).add({ days: 3 }),
  )
  const { data: priority } = useQuery(
    trpc.priority.list.queryOptions(
      { property_id: selectedPropertyId ?? 0, year: priorityYear },
      { enabled: open && selectedPropertyId != null },
    ),
  )
  const owners = priority?.eligibleOwners ?? []

  const currentUser = users?.find(u => u.id === selectedUserId)

  if (!open) return null
  // Mount the form only once its data is in, so the inspector default can be
  // plain initial state instead of an effect resyncing it later.
  if (procedureSteps == null || users == null) return <CardSkeleton />

  const procedureItems = procedureSteps
    .filter(s => {
      if (scope.kind === "structure") return s.structure_id === scope.id
      if (scope.kind === "infrastructure")
        return s.infrastructure_id === scope.id
      return s.equipment_id === scope.id
    })
    .slice()
    .sort((a, b) => {
      const aP = a.position ?? Number.MAX_SAFE_INTEGER
      const bP = b.position ?? Number.MAX_SAFE_INTEGER
      if (aP !== bP) return aP - bP
      return Temporal.Instant.compare(a.created_at, b.created_at)
    })

  return (
    <InspectionFlowForm
      scope={scope}
      onClose={onClose}
      procedureItems={procedureItems}
      owners={owners}
      defaultInspectedBy={currentUser?.name ?? ""}
    />
  )
}

function InspectionFlowForm(props: {
  scope: InspectionScope
  onClose: () => void
  procedureItems: readonly ProcedureItem[]
  owners: readonly PriorityOwner[]
  defaultInspectedBy: string
}) {
  const { t } = useTranslation("maintenance")
  const { scope, onClose, procedureItems, owners, defaultInspectedBy } = props
  const trpc = useTRPC()
  const selectedUserId = useSelectedUserId()

  const [notes, setNotes] = useState<PortableTextBlock[]>([])
  const [cadence, setCadence] = useState<CadenceSelection>({
    recurrence: "spring",
  })
  const [procState, setProcState] = useState<Record<number, ProcedureState>>({})
  const [newSteps, setNewSteps] = useState<NewStep[]>([])
  const [adHocs, setAdHocs] = useState<AdHoc[]>([])
  // Staged procedure-template edits — renames and removals are not persisted
  // until the inspection is completed (see handleSubmit).
  const [renamedSteps, setRenamedSteps] = useState<Record<number, string>>({})
  const [removedStepIds, setRemovedStepIds] = useState<number[]>([])

  const recordMutation = useMutationWithInvalidation(
    trpc.inspection.record.mutationOptions({
      onSuccess: () => {
        // The parent unmounts this form on close, so no manual reset needed.
        onClose()
      },
    }),
    [
      trpc.inspection.pathKey(),
      trpc.maintenance.pathKey(),
      trpc.procedureStep.pathKey(),
    ],
  )

  const reorderMutation = useMutationWithInvalidation(
    trpc.procedureStep.setOrder.mutationOptions(),
    [trpc.procedureStep.pathKey()],
  )

  const renameMutation = useMutationWithInvalidation(
    trpc.procedureStep.rename.mutationOptions(),
    [trpc.procedureStep.pathKey()],
  )

  // "Remove from procedure" archives the step: it stops recurring in future
  // inspections but its history (raised followups, originating inspection) is
  // preserved.
  const archiveMutation = useMutationWithInvalidation(
    trpc.procedureStep.archive.mutationOptions(),
    [trpc.procedureStep.pathKey()],
  )

  const { pending, error } = useMutationsStatus(
    recordMutation,
    reorderMutation,
    renameMutation,
    archiveMutation,
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

  const editProcedureItem = (id: number, description: string) => {
    setRenamedSteps(prev => ({ ...prev, [id]: description }))
  }

  const removeProcedureItem = (id: number) => {
    setRemovedStepIds(prev => (prev.includes(id) ? prev : [...prev, id]))
  }

  const restoreProcedureItem = (id: number) => {
    setRemovedStepIds(prev => prev.filter(x => x !== id))
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

  const addStep = () => {
    setNewSteps(prev => [
      ...prev,
      {
        key: crypto.randomUUID(),
        description: "",
        committed: false,
        status: "ok",
        followupDescription: "",
      },
    ])
  }

  const updateStep = (key: string, patch: Partial<NewStep>) => {
    setNewSteps(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)))
  }

  const commitStep = (key: string) => {
    setNewSteps(prev =>
      prev.map(s =>
        s.key === key && s.description.trim().length > 0
          ? { ...s, committed: true }
          : s,
      ),
    )
  }

  const editStep = (key: string) => {
    setNewSteps(prev =>
      prev.map(s => (s.key === key ? { ...s, committed: false } : s)),
    )
  }

  const removeStep = (key: string) => {
    setNewSteps(prev => prev.filter(s => s.key !== key))
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
    setAdHocs(prev => prev.map(a => (a.key === key ? { ...a, ...patch } : a)))
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

  const handleSubmit = async () => {
    if (selectedUserId == null) return
    // Inspected-by is implicit: the inspection is recorded as the user who
    // submits it (see defaultInspectedBy / the server's started_by_user_id).
    const inspectedBy = defaultInspectedBy.trim()
    if (!inspectedBy) return

    // Steps staged for removal are dropped from this inspection's findings and
    // archived below, so they neither recur nor raise a followup this cycle.
    const procFindings = procedureItems
      .filter(item => !removedStepIds.includes(item.id))
      .map(item => {
        const state = getProc(item.id, item.description)
        return {
          kind: "step_result" as const,
          step_id: item.id,
          status: state.status,
          ...(state.status === "followup"
            ? {
                followup_description:
                  state.description.trim() || item.description,
              }
            : {}),
        }
      })

    // New steps join the procedure and recur next time. A step flagged "needs
    // followup" also raises a one-off todo this cycle, linked server-side to
    // the step it created.
    const stepFindings = newSteps
      .filter(s => s.description.trim().length > 0)
      .map(s => ({
        kind: "new_step" as const,
        description: s.description.trim(),
        ...(s.status === "followup"
          ? {
              followup_description:
                s.followupDescription.trim() || s.description.trim(),
            }
          : {}),
      }))

    const adHocFindings = adHocs
      .filter(a => a.description.trim().length > 0)
      .map(a => ({
        kind: "ad_hoc" as const,
        description: a.description.trim(),
        pin: a.pin,
      }))

    try {
      // Apply staged procedure-template edits before recording the inspection.
      // Renames that match the original (e.g. edited then reverted) and renames
      // of removed steps are skipped; removals are archived so they stop
      // recurring while the inspection-history record is preserved.
      for (const [idStr, description] of Object.entries(renamedSteps)) {
        const id = Number(idStr)
        if (removedStepIds.includes(id)) continue
        const original = procedureItems.find(p => p.id === id)?.description
        if (original == null || description === original) continue
        await renameMutation.mutateAsync({ id, description })
      }
      for (const id of removedStepIds) {
        await archiveMutation.mutateAsync({ id })
      }
      await recordMutation.mutateAsync({
        ...(scope.kind === "structure" ? { structure_id: scope.id } : {}),
        ...(scope.kind === "infrastructure"
          ? { infrastructure_id: scope.id }
          : {}),
        ...(scope.kind === "equipment" ? { equipment_id: scope.id } : {}),
        inspected_by: inspectedBy,
        recurrence: cadence.recurrence,
        cadence_priority_group_id: cadence.cadence_priority_group_id,
        notes_pt: notes.length > 0 ? notes : undefined,
        findings: [...procFindings, ...stepFindings, ...adHocFindings],
      })
    } catch {
      // Surfaced via the aggregated ErrorAlert below.
    }
  }

  return (
    <form action={handleSubmit} className={styles.wrap}>
      <MetadataSection
        value={cadence}
        owners={owners}
        disabled={pending}
        onChange={setCadence}
      />

      <ProcedureSection
        items={procedureItems}
        getProc={getProc}
        setProc={setProc}
        moveProcedureItem={moveProcedureItem}
        reorderPending={reorderMutation.isPending}
        editProcedureItem={editProcedureItem}
        removeProcedureItem={removeProcedureItem}
        restoreProcedureItem={restoreProcedureItem}
        stagedDescriptions={renamedSteps}
        removedItemIds={removedStepIds}
        disabled={pending}
        newSteps={newSteps}
        addStep={addStep}
        updateStep={updateStep}
        commitStep={commitStep}
        editStep={editStep}
        removeStep={removeStep}
      />

      <FindingsSection
        adHocs={adHocs}
        addAdHoc={addAdHoc}
        updateAdHoc={updateAdHoc}
        commitAdHoc={commitAdHoc}
        editAdHoc={editAdHoc}
        removeAdHoc={removeAdHoc}
      />

      <Field>
        <Label>{t("Notes")}</Label>
        <MaintenanceInstructionsPTEditor
          initialValue={notes}
          onChange={setNotes}
        />
      </Field>

      <ErrorAlert error={error} />

      <div className={styles.actions}>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          {t("Cancel")}
        </Button>
        <SubmitButton disabled={selectedUserId == null}>
          {t("Complete inspection")}
        </SubmitButton>
      </div>
    </form>
  )
}
