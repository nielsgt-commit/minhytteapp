import { Button, Radio, Table } from "@digdir/designsystemet-react"
import {
  type EligibleOwner,
  type PeakWeek,
  formatRange,
  peakWeekRange,
} from "@/features/priority/priorityUtils"

type PriorityWeekRowProps = {
  week: PeakWeek
  year: number
  eligibleOwners: readonly EligibleOwner[]
  ownersForWeek: readonly number[]
  meUserId: number | undefined
  myOwnerId: number | null
  isAdmin: boolean
  pending: boolean
  onAssign: (ownerId: number, week: PeakWeek) => void
  onClear: (ownerId: number) => void
}

export function PriorityWeekRow({
  week,
  year,
  eligibleOwners,
  ownersForWeek,
  meUserId,
  myOwnerId,
  isAdmin,
  pending,
  onAssign,
  onClear,
}: PriorityWeekRowProps) {
  const range = peakWeekRange(year, week)
  const showClear =
    ownersForWeek.length > 0 &&
    (isAdmin || (myOwnerId != null && ownersForWeek.includes(myOwnerId)))

  return (
    <Table.Row>
      <Table.Cell>W{week}</Table.Cell>
      <Table.Cell>{formatRange(range)}</Table.Cell>
      {eligibleOwners.map(o => {
        const checked = ownersForWeek.includes(o.property_owner_id)
        const isMyColumn = o.user_id === meUserId
        const editable = (isMyColumn || isAdmin) && !pending
        return (
          <Table.Cell key={o.property_owner_id}>
            <Radio
              aria-label={`W${String(week)} – ${o.user_name}`}
              name={`priority-week-owner-${String(o.property_owner_id)}`}
              value={String(week)}
              checked={checked}
              disabled={!editable}
              onChange={() => { onAssign(o.property_owner_id, week) }}
            />
          </Table.Cell>
        )
      })}
      <Table.Cell>
        {showClear && (
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            disabled={pending}
            onClick={() => {
              const targetOwnerId = isAdmin ? ownersForWeek[0] : myOwnerId
              if (targetOwnerId == null) return
              onClear(targetOwnerId)
            }}
          >
            Clear
          </Button>
        )}
      </Table.Cell>
    </Table.Row>
  )
}
