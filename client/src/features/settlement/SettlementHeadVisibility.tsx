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
    <fieldset>
      <legend>Show other heads</legend>
      {others.map(h => (
        <label key={h.id}>
          <input
            type="checkbox"
            checked={visibleIds.has(h.id)}
            onChange={() => { onToggle(h.id) }}
          />
          {h.name}
        </label>
      ))}
    </fieldset>
  )
}