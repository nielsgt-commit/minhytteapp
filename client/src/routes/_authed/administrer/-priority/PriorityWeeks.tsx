import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button, Card, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import section from "@/components/layouts/manageSection.module.css"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import {
  type Season,
  groupAssignmentsBySeason,
  isCrossYear,
} from "@/utils/seasonUtils"
import {
  PEAK_WEEKS,
  buildOwnerLookups,
  defaultYear,
} from "@/utils/priorityUtils"
import { YearNavigator } from "./YearNavigator"
import { PriorityWeeksTable } from "./PriorityWeeksTable"

export function PriorityWeeks() {
  const { t } = useTranslation("priority")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const [year, setYear] = useState<number>(defaultYear())

  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const groupsQuery = useQuery({
    ...trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
    enabled: selectedPropertyId != null,
  })

  const priorityQuery = useQuery({
    ...trpc.priority.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
      year,
    }),
    enabled: selectedPropertyId != null,
  })

  const seasonsQuery = useQuery({
    ...trpc.season.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
    enabled: selectedPropertyId != null,
  })

  const setMutation = useMutationWithInvalidation(
    trpc.priority.set.mutationOptions(),
    [trpc.priority.pathKey()],
  )
  const clearMutation = useMutationWithInvalidation(
    trpc.priority.clear.mutationOptions(),
    [trpc.priority.pathKey()],
  )
  const { pending, error: lastError } = useMutationsStatus(
    setMutation,
    clearMutation,
  )

  if (selectedPropertyId == null) {
    return (
      <Paragraph>{t("Select a property to manage priority weeks.")}</Paragraph>
    )
  }

  if (priorityQuery.isError) return <ErrorAlert error={priorityQuery.error} />
  if (seasonsQuery.isError) return <ErrorAlert error={seasonsQuery.error} />

  const data = priorityQuery.data
  const seasons = seasonsQuery.data
  if (!data || !seasons) return <CardSkeleton />

  const { eligibleOwners, assignments } = data
  const myMainGroup = me
    ? groupsQuery.data?.find(
        g => g.is_family && g.members.some(m => m.user_id === me.id),
      )
    : undefined
  const myGroupId =
    myMainGroup != null &&
    eligibleOwners.some(o => o.user_group_id === myMainGroup.id)
      ? myMainGroup.id
      : null
  const isAdmin = me?.is_admin === true

  const ownerNameById = new Map(
    eligibleOwners.map(o => [o.user_group_id, o.user_group_name]),
  )

  const handleAssign =
    (seasonId: number | null) => (groupId: number, week: number) => {
      setMutation.mutate({
        property_id: selectedPropertyId,
        user_group_id: groupId,
        year,
        iso_week: week,
        season_id: seasonId,
      })
    }

  const handleClear = (seasonId: number | null) => (groupId: number) => {
    clearMutation.mutate({
      property_id: selectedPropertyId,
      user_group_id: groupId,
      year,
      season_id: seasonId,
    })
  }

  if (eligibleOwners.length === 0) {
    return (
      <div className={section.column}>
        <Paragraph role="alert">
          {t(
            "No main owner groups found for this property. A family group must be a main owner group before it can be assigned a priority week.",
          )}
        </Paragraph>
        <ErrorAlert error={lastError} />
      </div>
    )
  }

  // Assignments are stored under the season's START year: the navigator year
  // for a Dec–Feb season means the instance that begins that December.
  const seasonHeading = (s: Season) =>
    isCrossYear(s)
      ? t("{{name}} {{fromYear}}/{{toYear}}", {
          name: s.name,
          fromYear: year,
          toYear: year + 1,
        })
      : t("{{name}} {{year}}", { name: s.name, year })

  // No seasons configured: the original single table over the built-in
  // fallback weeks (28–30); picks are stored without a season.
  const grouped =
    seasons.length === 0 ? null : groupAssignmentsBySeason(seasons, assignments)
  const sections = grouped
    ? seasons.map(s => ({
        key: String(s.id),
        seasonId: s.id as number | null,
        season: s as Season,
        heading: seasonHeading(s) as string | null,
        weeks: s.priority_weeks,
        assignments: grouped.bySeason.get(s.id) ?? [],
      }))
    : [
        {
          key: "fallback",
          seasonId: null,
          season: null,
          heading: null,
          weeks: PEAK_WEEKS,
          assignments,
        },
      ]
  const unadopted = grouped?.unadopted ?? []

  return (
    <div className={section.column}>
      {myGroupId == null && !isAdmin && (
        <Paragraph>
          {t(
            "You don't have an editable column here. Either you're not an owner of this property, or your family group isn't a main owner group.",
          )}
        </Paragraph>
      )}

      <Card>
        <Card.Block className={section.column}>
          <YearNavigator year={year} onChange={setYear} />
        </Card.Block>
      </Card>

      {sections.map(sec => {
        const lookups = buildOwnerLookups(eligibleOwners, sec.assignments)
        const unassigned = sec.weeks.filter(
          w => (lookups.ownersByWeek.get(w)?.length ?? 0) === 0,
        )
        return (
          <Card key={sec.key}>
            <Card.Block className={section.column}>
              {sec.heading && (
                <Heading level={3} data-size="xs">
                  {sec.heading}
                </Heading>
              )}

              {sec.weeks.length === 0 ? (
                <Paragraph>
                  {t("No priority weeks configured for this season.")}
                </Paragraph>
              ) : (
                <>
                  {unassigned.length > 0 && (
                    <Paragraph role="status">
                      {t(
                        "{{count}} of {{total}} peak weeks still unassigned (W{{weeks}}).",
                        {
                          count: unassigned.length,
                          total: sec.weeks.length,
                          weeks: unassigned.join(", W"),
                        },
                      )}
                    </Paragraph>
                  )}

                  <PriorityWeeksTable
                    year={year}
                    season={sec.season}
                    weeks={sec.weeks}
                    eligibleOwners={eligibleOwners}
                    lookups={lookups}
                    myGroupId={myGroupId}
                    isAdmin={isAdmin}
                    pending={pending}
                    onAssign={handleAssign(sec.seasonId)}
                    onClear={handleClear(sec.seasonId)}
                  />
                </>
              )}
            </Card.Block>
          </Card>
        )
      })}

      {/* Picks made before seasons were configured whose week fits no season:
          still counted by settlements, so surfaced here instead of hidden. */}
      {unadopted.map(a => {
        const name =
          ownerNameById.get(a.user_group_id) ?? `#${String(a.user_group_id)}`
        const canClear = isAdmin || a.user_group_id === myGroupId
        return (
          <Paragraph key={a.id} data-size="sm">
            {t(
              "{{name}} has a legacy pick of W{{week}} outside all configured seasons.",
              { name, week: a.iso_week },
            )}{" "}
            {canClear && (
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                disabled={pending}
                onClick={() => {
                  handleClear(null)(a.user_group_id)
                }}
              >
                {t("Clear")}
              </Button>
            )}
          </Paragraph>
        )
      })}

      <ErrorAlert error={lastError} />
    </div>
  )
}
