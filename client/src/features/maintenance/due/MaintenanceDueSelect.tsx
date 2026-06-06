import { useEffect, useState } from "react"
import { Field, Select, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { toDateInputValue } from "@/utils/dateUtils"
import {
  type DueSelection,
  type DueValue,
  dueToToken,
  priorityGroupLabel,
  tokenToDue,
} from "./maintenanceDue.ts"

export type PriorityOwner = {
  user_group_id: number
  user_group_name: string
}

export function MaintenanceDueSelect({
  value,
  owners,
  disabled,
  onChange,
}: {
  value: DueValue
  owners: readonly PriorityOwner[]
  disabled?: boolean
  onChange: (selection: DueSelection) => void
}) {
  const { t } = useTranslation("maintenance")
  const [draftToken, setDraftToken] = useState<string | null>(null)
  const token = draftToken ?? dueToToken(value)

  // Local draft for the date input so the user can clear and retype freely
  // (an empty string never fires onChange). Resynced whenever value.due_at
  // changes externally — e.g. after a save/refetch — so it stays controlled.
  const [dateDraft, setDateDraft] = useState(() =>
    toDateInputValue(value.due_at),
  )
  useEffect(() => {
    setDateDraft(toDateInputValue(value.due_at))
  }, [value.due_at])

  const handleSelect = (next: string) => {
    if (next === "date") {
      setDraftToken("date")
      return
    }
    setDraftToken(null)
    onChange(tokenToDue(next))
  }

  const handleDate = (str: string) => {
    setDateDraft(str)
    if (!str) return
    setDraftToken(null)
    // Parse at local noon (not `new Date(str)`, which is UTC midnight) so the
    // stored instant lands on the same calendar day the user picked regardless
    // of timezone, round-tripping with toDateInputValue's local-day formatting.
    onChange({ due_kind: "date", due_at: new Date(`${str}T12:00:00`) })
  }

  return (
    <Field>
      <Select
        data-size="sm"
        aria-label={t("Due")}
        value={token}
        disabled={disabled}
        onChange={e => {
          handleSelect(e.target.value)
        }}
      >
        <Select.Option value="not_decided">{t("Not decided")}</Select.Option>
        <Select.Option value="dugnad">{t("Dugnad")}</Select.Option>
        <Select.Option value="opening">{t("Opening")}</Select.Option>
        <Select.Option value="closing">{t("Closing")}</Select.Option>
        {owners.map(o => (
          <Select.Option
            key={o.user_group_id}
            value={`group:${String(o.user_group_id)}`}
          >
            {priorityGroupLabel(t, o.user_group_name)}
          </Select.Option>
        ))}
        <Select.Option value="date">{t("Specific date")}</Select.Option>
      </Select>
      {token === "date" && (
        <Textfield
          type="date"
          data-size="sm"
          aria-label={t("Due date")}
          // Controlled via dateDraft (synced to value.due_at) so external
          // changes reflect without a remount and the field stays clearable.
          value={dateDraft}
          disabled={disabled}
          onChange={e => {
            handleDate(e.target.value)
          }}
        />
      )}
    </Field>
  )
}
