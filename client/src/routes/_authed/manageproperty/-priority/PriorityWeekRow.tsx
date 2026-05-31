import { Button, Radio, Table } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  type EligibleOwner,
  type PeakWeek,
  formatRange,
  peakWeekRange,
} from "./priorityUtils"

type PriorityWeekRowProps = {
  week: PeakWeek
  year: number
  eligibleOwners: readonly EligibleOwner[]
  ownersForWeek: readonly number[]
  myGroupId: number | null
  isAdmin: boolean
  pending: boolean
  onAssign: (groupId: number, week: PeakWeek) => void
  onClear: (groupId: number) => void
}

export function PriorityWeekRow({
  week,
  year,
  eligibleOwners,
  ownersForWeek,
  myGroupId,
  isAdmin,
  pending,
  onAssign,
  onClear,
}: PriorityWeekRowProps) {
  const { t } = useTranslation("priority")
  const range = peakWeekRange(year, week)
  const showClear =
    ownersForWeek.length > 0 &&
    (isAdmin || (myGroupId != null && ownersForWeek.includes(myGroupId)))

  return (
    <Table.Row>
      <Table.Cell>{t("W{{week}}", { week })}</Table.Cell>
      <Table.Cell>{formatRange(range)}</Table.Cell>
      {eligibleOwners.map(o => {
        const checked = ownersForWeek.includes(o.user_group_id)
        const isMyColumn = o.user_group_id === myGroupId
        const editable = (isMyColumn || isAdmin) && !pending
        return (
          <Table.Cell key={o.user_group_id}>
            <Radio
              aria-label={t("W{{week}} – {{name}}", {
                week,
                name: o.user_group_name,
              })}
              name={`priority-week-owner-${String(o.user_group_id)}`}
              value={String(week)}
              checked={checked}
              disabled={!editable}
              onChange={() => {
                onAssign(o.user_group_id, week)
              }}
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
              const targetGroupId = isAdmin ? ownersForWeek[0] : myGroupId
              if (targetGroupId == null) return
              onClear(targetGroupId)
            }}
          >
            {t("Clear")}
          </Button>
        )}
      </Table.Cell>
    </Table.Row>
  )
}
