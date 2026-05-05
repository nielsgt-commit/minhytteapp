export function BuildingFilter({
  buildings,
  hiddenIds,
  onToggle,
}: {
  buildings: { id: number; name: string }[]
  hiddenIds: ReadonlySet<number>
  onToggle: (id: number) => void
}) {
  return (
    <fieldset>
      <legend>Show buildings</legend>
      {buildings.map(b => (
        <label key={b.id}>
          <input
            type="checkbox"
            checked={!hiddenIds.has(b.id)}
            onChange={() => { onToggle(b.id) }}
          />
          {b.name}
        </label>
      ))}
    </fieldset>
  )
}