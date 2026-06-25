import {
  useSelectedPropertyId,
  useSelectedUserId,
} from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button, Field, Heading, Label } from "@digdir/designsystemet-react"
import type { PortableTextBlock } from "@portabletext/types"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import styles from "./InspectionFlow.module.css"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
import {
  FindingsSection,
  type AdHoc,
} from "@/features/maintenance/inspectionflow/FindingsSection.tsx"
import {
  MetadataSection,
  type Recurrence,
} from "@/features/maintenance/inspectionflow/MetadataSection.tsx"
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

  const { data: maintenanceItems } = useQuery(
    trpc.maintenance.listForProperty.queryOptions(
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

  const currentUser = users?.find(u => u.id === selectedUserId)

  if (!open) return null
  // Mount the form only once its data is in, so the inspector default can be
  // plain initial state instead of an effect resyncing it later.
  if (maintenanceItems == null || users == null) return <CardSkeleton />

  const procedureItems = maintenanceItems
    .filter(m => {
      if (!m.is_pinned) return false
      if (scope.kind === "structure") {
        return m.structure_id === scope.id && m.equipment_id == null
      }
      if (scope.kind === "infrastructure")
        return m.infrastructure_id === scope.id
      return m.equipment_id === scope.id
    })
    .slice()
    .sort((a, b) => {
      const aP = a.procedure_position ?? Number.MAX_SAFE_INTEGER
      const bP = b.procedure_position ?? Number.MAX_SAFE_INTEGER
      if (aP !== bP) return aP - bP
      return Temporal.Instant.compare(a.created_at, b.created_at)
    })

  return (
    <InspectionFlowForm
      scope={scope}
      onClose={onClose}
      procedureItems={procedureItems}
      defaultInspectedBy={currentUser?.name ?? ""}
    />
  )
}

function InspectionFlowForm(props: {
  scope: InspectionScope
  onClose: () => void
  procedureItems: readonly ProcedureItem[]
  defaultInspectedBy: string
}) {
  const { t } = useTranslation("maintenance")
  const { scope, onClose, procedureItems, defaultInspectedBy } = props
  const trpc = useTRPC()
  const selectedUserId = useSelectedUserId()

  const [notes, setNotes] = useState<PortableTextBlock[]>([])
  const [procState, setProcState] = useState<Record<number, ProcedureState>>({})
  const [newSteps, setNewSteps] = useState<NewStep[]>([])
  const [adHocs, setAdHocs] = useState<AdHoc[]>([])

  const recordMutation = useMutationWithInvalidation(
    trpc.inspection.record.mutationOptions({
      onSuccess: () => {
        // The parent unmounts this form on close, so no manual reset needed.
        onClose()
      },
    }),
    [trpc.inspection.pathKey(), trpc.maintenance.pathKey()],
  )

  const reorderMutation = useMutationWithInvalidation(
    trpc.maintenance.setProcedureOrder.mutationOptions(),
    [trpc.maintenance.pathKey()],
  )

  const { pending, error } = useMutationsStatus(recordMutation, reorderMutation)

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

  const handleSubmit = async (fd: FormData) => {
    if (selectedUserId == null) return
    // Inspected-by is implicit: the inspection is recorded as the user who
    // submits it (see defaultInspectedBy / the server's started_by_user_id).
    const inspectedBy = defaultInspectedBy.trim()
    if (!inspectedBy) return
    const recurrence = fdString(fd, "recurrence") as Recurrence

    const procFindings = procedureItems.map(item => {
      const state = getProc(item.id, item.description)
      return {
        pinned_maintenance_id: item.id,
        description: state.description.trim() || item.description,
        pin: false,
        status: state.status,
      }
    })

    // New steps are pinned so they join the procedure and recur next time.
    // A step flagged "needs followup" also raises a one-off todo this cycle,
    // linked server-side to the step it created.
    const stepFindings = newSteps
      .filter(s => s.description.trim().length > 0)
      .map(s => ({
        description: s.description.trim(),
        pin: true,
        status: "ok" as const,
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
        description: a.description.trim(),
        pin: a.pin,
        status: "followup" as const,
      }))

    try {
      await recordMutation.mutateAsync({
        ...(scope.kind === "structure" ? { structure_id: scope.id } : {}),
        ...(scope.kind === "infrastructure"
          ? { infrastructure_id: scope.id }
          : {}),
        ...(scope.kind === "equipment" ? { equipment_id: scope.id } : {}),
        inspected_by: inspectedBy,
        recurrence,
        notes_pt: notes.length > 0 ? notes : undefined,
        findings: [...procFindings, ...stepFindings, ...adHocFindings],
      })
    } catch {
      // Surfaced via the aggregated ErrorAlert below.
    }
  }

  return (
    <form action={handleSubmit} className={styles.wrap}>
      <Heading level={4} data-size="xs">
        {t("Inspect {{name}}", { name: scope.name })}
      </Heading>

      <MetadataSection />

      <ProcedureSection
        items={procedureItems}
        getProc={getProc}
        setProc={setProc}
        moveProcedureItem={moveProcedureItem}
        reorderPending={reorderMutation.isPending}
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
