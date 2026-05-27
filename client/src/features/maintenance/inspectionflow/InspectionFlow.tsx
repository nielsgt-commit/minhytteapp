import { useSelectedUserId } from "@/features/user/userSlice"
import { type SyntheticEvent, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Field,
  Heading,
  Label,
  Paragraph,
} from "@digdir/designsystemet-react"
import type { PortableTextBlock } from "@portabletext/types"
import { useTranslation } from "react-i18next"
import styles from "./InspectionFlow.module.css"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
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
  const { t } = useTranslation("maintenance")
  const { scope, open, onClose } = props
  const trpc = useTRPC()
  const selectedUserId = useSelectedUserId()

  const { data: maintenanceItems } = useQuery(
    trpc.maintenance.list.queryOptions(undefined, { enabled: open }),
  )
  const { data: users } = useQuery(
    trpc.user.list.queryOptions(undefined, { enabled: open }),
  )

  const currentUser = users?.find(u => u.id === selectedUserId)

  const procedureItems = (maintenanceItems ?? [])
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
      const aT = new Date(a.created_at).getTime()
      const bT = new Date(b.created_at).getTime()
      return aT - bT
    })

  const [inspectedBy, setInspectedBy] = useState("")
  const [recurrence, setRecurrence] = useState<Recurrence>("yearly")
  const [notes, setNotes] = useState<PortableTextBlock[]>([])
  const [procState, setProcState] = useState<Record<number, ProcedureState>>({})
  const [adHocs, setAdHocs] = useState<AdHoc[]>([])

  useEffect(() => {
    if (open && !inspectedBy && currentUser?.name) {
      setInspectedBy(currentUser.name)
    }
  }, [open, currentUser, inspectedBy])

  const recordMutation = useMutationWithInvalidation(
    trpc.inspection.record.mutationOptions({
      onSuccess: () => {
        resetForm()
        onClose()
      },
    }),
    [trpc.inspection.pathKey(), trpc.maintenance.pathKey()],
  )

  const reorderMutation = useMutationWithInvalidation(
    trpc.maintenance.setProcedureOrder.mutationOptions(),
    [trpc.maintenance.pathKey()],
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
    setNotes([])
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
      ...(scope.kind === "infrastructure"
        ? { infrastructure_id: scope.id }
        : {}),
      ...(scope.kind === "equipment" ? { equipment_id: scope.id } : {}),
      inspected_by: inspectedBy.trim(),
      recurrence,
      notes_pt: notes.length > 0 ? notes : undefined,
      findings: [...procFindings, ...adHocFindings],
    })
  }

  const disabled = recordMutation.isPending || selectedUserId == null

  if (!open) return null

  return (
    <form onSubmit={handleSubmit} className={styles.wrap}>
      <Heading level={4} data-size="xs">
        {t("Inspect {{name}}", { name: scope.name })}
      </Heading>

      <MetadataSection
        inspectedBy={inspectedBy}
        setInspectedBy={setInspectedBy}
        recurrence={recurrence}
        setRecurrence={setRecurrence}
      />

      <ProcedureSection
        items={procedureItems}
        getProc={getProc}
        setProc={setProc}
        moveProcedureItem={moveProcedureItem}
        reorderPending={reorderMutation.isPending}
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
          {t("Cancel")}
        </Button>
        <Button type="submit" disabled={disabled}>
          {t("Complete inspection")}
        </Button>
      </div>
    </form>
  )
}
