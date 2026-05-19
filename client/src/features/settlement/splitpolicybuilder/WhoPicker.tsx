import { Field, Label, Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { GroupWithMembers, PropertyUser } from "./types"

type Props = {
  propertyUsers: PropertyUser[]
  groups: GroupWithMembers[]
  selectedEncoded: Set<string>
  onAdd: (encoded: string) => void
}

export function WhoPicker({
  propertyUsers,
  groups,
  selectedEncoded,
  onAdd,
}: Props) {
  const { t } = useTranslation("settlement")
  return (
    <Field>
      <Label data-size="sm">{t("Add participant")}</Label>
      <Select
        value=""
        onChange={e => {
          onAdd(e.target.value)
          e.target.value = ""
        }}
      >
        <Select.Option value="">{t("— pick a participant —")}</Select.Option>
        <Select.Option value="all_users" disabled={selectedEncoded.has("all_users")}>
          {t("all users")}
        </Select.Option>
        <Select.Option value="main_groups" disabled={selectedEncoded.has("main_groups")}>
          {t("main owner groups")}
        </Select.Option>
        <Select.Option value="heads_only" disabled={selectedEncoded.has("heads_only")}>
          {t("heads of this property")}
        </Select.Option>
        <Select.Optgroup label={t("Groups")}>
          {groups.map(g => {
            const enc = `user_group:${String(g.id)}`
            return (
              <Select.Option key={enc} value={enc} disabled={selectedEncoded.has(enc)}>
                {g.name}
              </Select.Option>
            )
          })}
        </Select.Optgroup>
        <Select.Optgroup label={t("Users")}>
          {propertyUsers.map(u => {
            const enc = `user:${String(u.user_id)}`
            return (
              <Select.Option key={enc} value={enc} disabled={selectedEncoded.has(enc)}>
                {u.user_name}
              </Select.Option>
            )
          })}
        </Select.Optgroup>
      </Select>
    </Field>
  )
}
