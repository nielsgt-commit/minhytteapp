import { useSuspenseQuery } from "@tanstack/react-query"
import { Divider, Heading, Table, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import {
  PEAK_WEEKS,
  buildOwnerLookups,
  defaultYear,
  formatRange,
  peakWeekRange,
} from "@/routes/_authed/administrer/-priority/priorityUtils"
import styles from "./PriorityWeeksPanel.module.css"

// Read-only dashboard view of which owner group holds each peak week.
// Editing lives under Manage property → Priority weeks.
export function PriorityWeeksPanel({ propertyId }: { propertyId: number }) {
  const { t, i18n } = useTranslation("priority")
  const trpc = useTRPC()
  const year = defaultYear()

  const { data } = useSuspenseQuery(
    trpc.priority.list.queryOptions({ property_id: propertyId, year }),
  )

  const { eligibleOwners, assignments } = data
  const { ownersByWeek, ownerNameById } = buildOwnerLookups(
    eligibleOwners,
    assignments,
  )

  return (
    <div>
      <Heading level={2} data-size="xs">
        {t("Priority weeks {{year}}", { year })}
      </Heading>
      <Divider className={styles.divider} />
      <Table data-size="sm">
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{t("Week")}</Table.HeaderCell>
            <Table.HeaderCell>{t("Dates")}</Table.HeaderCell>
            <Table.HeaderCell>{t("Owner")}</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {PEAK_WEEKS.map(week => {
            const range = peakWeekRange(year, week)
            const owners = ownersByWeek.get(week) ?? []
            const names = owners.map(
              id => ownerNameById.get(id) ?? `#${String(id)}`,
            )
            return (
              <Table.Row key={week}>
                <Table.Cell>{week}</Table.Cell>
                <Table.Cell>{formatRange(range, i18n.language)}</Table.Cell>
                <Table.Cell>
                  {names.length === 0 ? (
                    <Tag data-size="sm" data-color="neutral">
                      {t("Unassigned")}
                    </Tag>
                  ) : (
                    names.join(", ")
                  )}
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
    </div>
  )
}
