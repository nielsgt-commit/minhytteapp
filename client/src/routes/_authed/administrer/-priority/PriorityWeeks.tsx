import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import section from "@/features/property/managePropertySection.module.css"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import {
  PEAK_WEEKS,
  type PeakWeek,
  buildOwnerLookups,
  defaultYear,
} from "./priorityUtils"
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

  const data = priorityQuery.data
  if (!data) return <CardSkeleton />

  const { eligibleOwners, assignments } = data
  const lookups = buildOwnerLookups(eligibleOwners, assignments)
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

  const unassigned = PEAK_WEEKS.filter(
    w => (lookups.ownersByWeek.get(w)?.length ?? 0) === 0,
  )

  const handleAssign = (groupId: number, week: PeakWeek) => {
    setMutation.mutate({
      property_id: selectedPropertyId,
      user_group_id: groupId,
      year,
      iso_week: week,
    })
  }

  const handleClear = (groupId: number) => {
    clearMutation.mutate({
      property_id: selectedPropertyId,
      user_group_id: groupId,
      year,
    })
  }

  return (
    <div className={section.column}>
      {myGroupId == null && !isAdmin && (
        <Paragraph>
          {t(
            "You don't have an editable column here. Either you're not an owner of this property, or your family group isn't a main owner group.",
          )}
        </Paragraph>
      )}

      {eligibleOwners.length === 0 ? (
        <Paragraph role="alert">
          {t(
            "No main owner groups found for this property. A family group must be a main owner group before it can be assigned a priority week.",
          )}
        </Paragraph>
      ) : (
        <Card>
          <Card.Block className={section.column}>
            <YearNavigator year={year} onChange={setYear} />

            {unassigned.length > 0 && (
              <Paragraph role="status">
                {t(
                  "{{count}} of {{total}} peak weeks still unassigned (W{{weeks}}).",
                  {
                    count: unassigned.length,
                    total: PEAK_WEEKS.length,
                    weeks: unassigned.join(", W"),
                  },
                )}
              </Paragraph>
            )}

            <PriorityWeeksTable
              year={year}
              eligibleOwners={eligibleOwners}
              lookups={lookups}
              myGroupId={myGroupId}
              isAdmin={isAdmin}
              pending={pending}
              onAssign={handleAssign}
              onClear={handleClear}
            />
          </Card.Block>
        </Card>
      )}

      <ErrorAlert error={lastError} />
    </div>
  )
}
