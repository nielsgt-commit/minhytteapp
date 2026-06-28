import { useState } from "react"
import {
  Button,
  Field,
  Fieldset,
  Label,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { PortableTextBlock } from "@portabletext/types"
import type { Temporal } from "temporal-polyfill"
import { MaintenanceInstructionsPTEditor } from "./MaintenanceInstructionsPTEditor.tsx"
import {
  MaintenanceDueSelect,
  type PriorityOwner,
} from "@/features/maintenance/due/MaintenanceDueSelect.tsx"
import type {
  DueKind,
  DueSelection,
} from "@/features/maintenance/due/maintenanceDue.ts"
import styles from "./MaintenanceTodos.module.css"

export type MaintenanceTodoEditItem = {
  id: number
  description: string
  instructions_pt: PortableTextBlock[] | null
  due_kind: DueKind
  due_priority_group_id: number | null
  due_at: Temporal.Instant | null
}

export type MaintenanceTodoEditValues = {
  description: string
  instructions_pt: PortableTextBlock[] | null
  due: DueSelection
}

export function MaintenanceTodoEditForm({
  item,
  owners,
  pending,
  onSubmit,
  onCancel,
}: {
  item: MaintenanceTodoEditItem
  owners: readonly PriorityOwner[]
  pending: boolean
  onSubmit: (values: MaintenanceTodoEditValues) => void
  onCancel: () => void
}) {
  const { t } = useTranslation("maintenance")
  const [description, setDescription] = useState(item.description)
  const [instructionsPT, setInstructionsPT] = useState<PortableTextBlock[]>(
    item.instructions_pt ?? [],
  )
  const [due, setDue] = useState<DueSelection>({
    due_kind: item.due_kind,
    due_priority_group_id: item.due_priority_group_id ?? undefined,
    due_at: item.due_at ?? undefined,
  })

  const handleSave = () => {
    const trimmed = description.trim()
    if (!trimmed) return
    onSubmit({
      description: trimmed,
      instructions_pt: instructionsPT.length > 0 ? instructionsPT : null,
      due,
    })
  }

  return (
    <Fieldset>
      <Fieldset.Legend>{t("Edit task")}</Fieldset.Legend>
      <Textfield
        label={t("Task")}
        data-size="sm"
        value={description}
        onChange={e => {
          setDescription(e.target.value)
        }}
        required
      />
      <Field>
        <Label>{t("Description")}</Label>
        <MaintenanceInstructionsPTEditor
          initialValue={item.instructions_pt ?? undefined}
          onChange={setInstructionsPT}
        />
      </Field>
      <div className={styles.editDue}>
        <Label>{t("Due")}</Label>
        <MaintenanceDueSelect
          value={{
            due_kind: due.due_kind,
            due_priority_group_id: due.due_priority_group_id,
            due_at: due.due_at,
          }}
          owners={owners}
          disabled={pending}
          onChange={setDue}
        />
      </div>
      <div className={styles.confirmActions}>
        <Button
          variant="secondary"
          data-size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          {t("Cancel")}
        </Button>
        <Button
          data-size="sm"
          disabled={pending || description.trim().length === 0}
          onClick={handleSave}
        >
          {t("Save")}
        </Button>
      </div>
    </Fieldset>
  )
}
