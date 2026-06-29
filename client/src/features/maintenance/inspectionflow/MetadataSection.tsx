import { Field, Label, Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./InspectionFlow.module.css"
import type { PriorityOwner } from "@/features/maintenance/due/MaintenanceDueSelect.tsx"
import {
  type CadenceSelection,
  type CadenceValue,
  SELECTABLE_CADENCES,
  cadenceLabel,
  cadenceToToken,
  priorityGroupLabel,
  tokenToCadence,
} from "./inspectionCadence.ts"

// Re-exported for back-compat with importers that referenced the old name.
export type Recurrence = "yearly" | "spring" | "fall"

export function MetadataSection({
  value,
  owners,
  disabled,
  onChange,
}: {
  value: CadenceValue
  owners: readonly PriorityOwner[]
  disabled?: boolean
  onChange: (selection: CadenceSelection) => void
}) {
  const { t } = useTranslation("maintenance")
  return (
    <div className={styles.section}>
      <Field>
        <Label>{t("Cadence")}</Label>
        <Select
          aria-label={t("Cadence")}
          value={cadenceToToken(value)}
          disabled={disabled}
          onChange={e => {
            onChange(tokenToCadence(e.target.value))
          }}
        >
          {SELECTABLE_CADENCES.map(c => (
            <Select.Option key={c} value={c}>
              {cadenceLabel(t, c)}
            </Select.Option>
          ))}
          {owners.map(o => (
            <Select.Option
              key={o.user_group_id}
              value={`group:${String(o.user_group_id)}`}
            >
              {priorityGroupLabel(t, o.user_group_name)}
            </Select.Option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
