import { Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { GroupWithMembers, PropertyUser } from "./types"

type Props = {
  propertyUsers: PropertyUser[]
  groups: GroupWithMembers[]
  selectedEncoded: Set<string>
  onAdd: (encoded: string) => void
}

// Inline "exclude someone" dropdown — sits in the rule sentence right after the
// "except" label and any exclusion chips. The placeholder doubles as the label.
export function ExceptPicker({
  propertyUsers,
  groups,
  selectedEncoded,
  onAdd,
}: Props) {
  const { t } = useTranslation("settlement")
  return (
    <Select
      aria-label={t("Add exclude")}
      data-size="sm"
      data-width="auto"
      value=""
      onChange={e => {
        onAdd(e.target.value)
        e.target.value = ""
      }}
    >
      <Select.Option value="">{t("— pick someone to exclude —")}</Select.Option>
      <Select.Option value="kids" disabled={selectedEncoded.has("kids")}>
        {t("Kids (all child users)")}
      </Select.Option>
      <Select.Optgroup label={t("Users")}>
        {propertyUsers.map(u => {
          const enc = `user:${String(u.user_id)}`
          return (
            <Select.Option
              key={enc}
              value={enc}
              disabled={selectedEncoded.has(enc)}
            >
              {u.user_name}
            </Select.Option>
          )
        })}
      </Select.Optgroup>
      <Select.Optgroup label={t("Groups")}>
        {groups.map(g => {
          const enc = `group:${String(g.id)}`
          return (
            <Select.Option
              key={enc}
              value={enc}
              disabled={selectedEncoded.has(enc)}
            >
              {g.name}
            </Select.Option>
          )
        })}
      </Select.Optgroup>
    </Select>
  )
}
