import { Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { NO_TARGET } from "./targetToken"

type NamedRow = { id: number; name: string }

export function TargetSelect({
  name,
  value,
  onChange,
  structures,
  infrastructure,
  equipment,
}: {
  name?: string
  value?: string
  onChange?: (token: string) => void
  structures: readonly NamedRow[]
  infrastructure: readonly NamedRow[]
  equipment: readonly NamedRow[]
}) {
  const { t } = useTranslation("todos")
  return (
    <Select
      data-size="sm"
      name={name}
      aria-label={t("Target")}
      value={value}
      onChange={e => onChange?.(e.target.value)}
    >
      <Select.Option value={NO_TARGET}>
        {t("No target (general todo)")}
      </Select.Option>
      {structures.length > 0 && (
        <Select.Optgroup label={t("Building")}>
          {structures.map(s => (
            <Select.Option key={s.id} value={`structure:${String(s.id)}`}>
              {s.name}
            </Select.Option>
          ))}
        </Select.Optgroup>
      )}
      {infrastructure.length > 0 && (
        <Select.Optgroup label={t("Infrastructure")}>
          {infrastructure.map(i => (
            <Select.Option key={i.id} value={`infrastructure:${String(i.id)}`}>
              {i.name}
            </Select.Option>
          ))}
        </Select.Optgroup>
      )}
      {equipment.length > 0 && (
        <Select.Optgroup label={t("Equipment")}>
          {equipment.map(eq => (
            <Select.Option key={eq.id} value={`equipment:${String(eq.id)}`}>
              {eq.name}
            </Select.Option>
          ))}
        </Select.Optgroup>
      )}
    </Select>
  )
}
