import { Checkbox, Fieldset } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"

type Head = { id: number; name: string }

type Props = {
  others: Head[]
  visibleIds: Set<number>
  onToggle: (id: number) => void
}

export function SettlementHeadVisibility({
  others,
  visibleIds,
  onToggle,
}: Props) {
  const { t } = useTranslation("settlement")
  if (others.length === 0) return null
  return (
    <Fieldset>
      <Fieldset.Legend>{t("Show other heads")}</Fieldset.Legend>
      {others.map(h => (
        <Checkbox
          key={h.id}
          label={h.name}
          checked={visibleIds.has(h.id)}
          onChange={() => { onToggle(h.id) }}
        />
      ))}
    </Fieldset>
  )
}
