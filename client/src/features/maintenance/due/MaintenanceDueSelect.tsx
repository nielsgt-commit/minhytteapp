import { useState } from "react"
import { Field, Select, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
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
  // (an empty string never fires onChange). External changes to value.due_at
  // — e.g. after a save/refetch — resync via the parent keying this component
  // by entity id + due_at, which remounts it with a fresh draft.
  const [dateDraft, setDateDraft] = useState(() =>
    toDateInputValue(value.due_at),
  )

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
    // Anchor the picked day at Oslo noon (not UTC midnight) so the stored
    // instant lands on the same calendar day the user picked, round-tripping
    // with toDateInputValue's Oslo-day formatting.
    const due_at = Temporal.PlainDate.from(str)
      .toZonedDateTime({ timeZone: "Europe/Oslo", plainTime: "12:00" })
      .toInstant()
    onChange({ due_kind: "date", due_at })
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
          // Controlled via dateDraft so the field stays clearable; external
          // changes remount via the parent's key and re-init the draft.
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
