import { Table } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  PEAK_WEEKS,
  type EligibleOwner,
  type OwnerLookups,
  type PeakWeek,
} from "@/features/priority/priorityUtils"
import { PriorityWeekRow } from "@/features/priority/PriorityWeekRow"
import { ConflictRow } from "@/features/priority/ConflictRow"

type PriorityWeeksTableProps = {
  year: number
  eligibleOwners: readonly EligibleOwner[]
  lookups: OwnerLookups
  meUserId: number | undefined
  myOwnerId: number | null
  isAdmin: boolean
  pending: boolean
  onAssign: (ownerId: number, week: PeakWeek) => void
  onClear: (ownerId: number) => void
}

export function PriorityWeeksTable({
  year,
  eligibleOwners,
  lookups,
  meUserId,
  myOwnerId,
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
            <Table.HeaderCell key={o.property_owner_id}>
              {o.user_name}
              {o.user_id === meUserId ? t(" (you)") : ""}
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
            meUserId={meUserId}
            myOwnerId={myOwnerId}
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
