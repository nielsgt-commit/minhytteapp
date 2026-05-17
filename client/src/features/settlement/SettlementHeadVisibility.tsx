import { Checkbox, Fieldset } from "@digdir/designsystemet-react"

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
  if (others.length === 0) return null
  return (
    <Fieldset>
      <Fieldset.Legend>Show other heads</Fieldset.Legend>
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
