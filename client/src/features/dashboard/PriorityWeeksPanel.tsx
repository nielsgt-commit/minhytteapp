import { useSuspenseQuery } from "@tanstack/react-query"
import { Divider, Heading, Table, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import {
  PEAK_WEEKS,
  buildOwnerLookups,
  defaultYear,
  formatRange,
} from "@/routes/_authed/administrer/-priority/priorityUtils"
import {
  type Season,
  groupAssignmentsBySeason,
  weekRangeForSeason,
} from "@/features/seasons/seasonUtils"
import styles from "./PriorityWeeksPanel.module.css"

// Read-only dashboard view of which owner group holds each priority week.
// Editing lives under Manage property → Priority weeks.
export function PriorityWeeksPanel({ propertyId }: { propertyId: number }) {
  const { t, i18n } = useTranslation("priority")
  const trpc = useTRPC()
  const year = defaultYear()

  const { data } = useSuspenseQuery(
    trpc.priority.list.queryOptions({ property_id: propertyId, year }),
  )
  const { data: seasons } = useSuspenseQuery(
    trpc.season.list.queryOptions({ property_id: propertyId }),
  )

  const { eligibleOwners, assignments } = data

  // One block per configured season (its weeks, its adopted assignments); or
  // the original single fallback block over weeks 28–30 when none exist.
  const grouped =
    seasons.length === 0 ? null : groupAssignmentsBySeason(seasons, assignments)
  const blocks = grouped
    ? seasons
        .filter(s => s.priority_weeks.length > 0)
        .map(s => ({
          key: String(s.id),
          title: s.name,
          season: s as Season,
          weeks: s.priority_weeks,
          lookups: buildOwnerLookups(
            eligibleOwners,
            grouped.bySeason.get(s.id) ?? [],
          ),
        }))
    : [
        {
          key: "fallback",
          title: null as string | null,
          season: null as Season | null,
          weeks: PEAK_WEEKS,
          lookups: buildOwnerLookups(eligibleOwners, assignments),
        },
      ]

  return (
    <div>
      <Heading level={2} data-size="xs">
        {t("Priority weeks {{year}}", { year })}
      </Heading>
      <Divider className={styles.divider} />
      {blocks.map(block => (
        <div key={block.key}>
          {block.title && (
            <Heading level={3} data-size="2xs">
              {block.title}
            </Heading>
          )}
          <Table data-size="sm">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>{t("Week")}</Table.HeaderCell>
                <Table.HeaderCell>{t("Dates")}</Table.HeaderCell>
                <Table.HeaderCell>{t("Owner")}</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {block.weeks.map(week => {
                const range = weekRangeForSeason(block.season, year, week)
                const owners = block.lookups.ownersByWeek.get(week) ?? []
                const names = owners.map(
                  id => block.lookups.ownerNameById.get(id) ?? `#${String(id)}`,
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
      ))}
    </div>
  )
}
