import { Paragraph, Table } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { PeakWeek } from "./priorityUtils"

type ConflictRowProps = {
  week: PeakWeek
  names: readonly string[]
  colSpan: number
}

export function ConflictRow({ week, names, colSpan }: ConflictRowProps) {
  const { t } = useTranslation("priority")
  return (
    <Table.Row>
      <Table.Cell colSpan={colSpan}>
        <Paragraph role="alert">
          {t("Conflict on W{{week}}: {{names}} have both claimed this week. Resolve in person — the system will not pick a winner.", { week, names: names.join(t(" and ")) })}
        </Paragraph>
      </Table.Cell>
    </Table.Row>
  )
}
