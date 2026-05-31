import { Table } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  PEAK_WEEKS,
  type EligibleOwner,
  type OwnerLookups,
  type PeakWeek,
} from "./priorityUtils"
import { PriorityWeekRow } from "./PriorityWeekRow"
import { ConflictRow } from "./ConflictRow"

type PriorityWeeksTableProps = {
  year: number
  eligibleOwners: readonly EligibleOwner[]
  lookups: OwnerLookups
  myGroupId: number | null
  isAdmin: boolean
  pending: boolean
  onAssign: (groupId: number, week: PeakWeek) => void
  onClear: (groupId: number) => void
}

export function PriorityWeeksTable({
  year,
  eligibleOwners,
  lookups,
  myGroupId,
  isAdmin,
  pending,
  onAssign,
  onClear,
}: PriorityWeeksTableProps) {
  const { t } = useTranslation("priority")
  const { ownersByWeek, ownerNameById } = lookups
  const conflictColSpan = 2 + eligibleOwners.length + 1

  return (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>{t("Week")}</Table.HeaderCell>
          <Table.HeaderCell>{t("Dates")}</Table.HeaderCell>
          {eligibleOwners.map(o => (
            <Table.HeaderCell key={o.user_group_id}>
              {o.user_group_name}
              {o.user_group_id === myGroupId ? t(" (you)") : ""}
            </Table.HeaderCell>
          ))}
          <Table.HeaderCell />
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {PEAK_WEEKS.map(week => (
          <PriorityWeekRow
            key={week}
            week={week}
            year={year}
            eligibleOwners={eligibleOwners}
            ownersForWeek={ownersByWeek.get(week) ?? []}
            myGroupId={myGroupId}
            isAdmin={isAdmin}
            pending={pending}
            onAssign={onAssign}
            onClear={onClear}
          />
        ))}
        {PEAK_WEEKS.flatMap(week => {
          const ownersForWeek = ownersByWeek.get(week) ?? []
          if (ownersForWeek.length <= 1) return []
          const names = ownersForWeek.map(
            id => ownerNameById.get(id) ?? `#${String(id)}`,
          )
          return [
            <ConflictRow
              key={`conflict-${String(week)}`}
              week={week}
              names={names}
              colSpan={conflictColSpan}
            />,
          ]
        })}
      </Table.Body>
    </Table>
  )
}
