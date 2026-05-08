import { Chip } from "@digdir/designsystemet-react"

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
    <>
      {buildings.map(b => (
        <Chip.Checkbox
          key={b.id}
          checked={!hiddenIds.has(b.id)}
          onChange={() => {
            onToggle(b.id)
          }}
        >
          {b.name}
        </Chip.Checkbox>
      ))}
    </>
  )
}