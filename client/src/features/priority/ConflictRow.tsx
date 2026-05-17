import { Paragraph, Table } from "@digdir/designsystemet-react"
import type { PeakWeek } from "@/features/priority/priorityUtils"

type ConflictRowProps = {
  week: PeakWeek
  names: readonly string[]
  colSpan: number
}

export function ConflictRow({ week, names, colSpan }: ConflictRowProps) {
  return (
    <Table.Row>
      <Table.Cell colSpan={colSpan}>
        <Paragraph role="alert">
          Conflict on W{week}: {names.join(" and ")} have both claimed this
          week. Resolve in person — the system will not pick a winner.
        </Paragraph>
      </Table.Cell>
    </Table.Row>
  )
}
