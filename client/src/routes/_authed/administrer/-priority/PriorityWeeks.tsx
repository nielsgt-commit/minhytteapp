import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import section from "@/features/property/managePropertySection.module.css"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import {
  PEAK_WEEKS,
  type PeakWeek,
  buildOwnerLookups,
  defaultYear,
} from "./priorityUtils"
import { YearNavigator } from "./YearNavigator"
import { PriorityWeeksTable } from "./PriorityWeeksTable"
import { usePrioritySliceSync } from "./usePrioritySliceSync"

export function PriorityWeeks() {
  const { t } = useTranslation("priority")
  const trpc = useTRPC()
  const qc = useQueryClient()
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

  usePrioritySliceSync(priorityQuery.data, year)

  const invalidate = () => {
    if (selectedPropertyId == null) return
    void qc.invalidateQueries({
      queryKey: trpc.priority.list.queryKey({
        property_id: selectedPropertyId,
        year,
      }),
    })
  }

  const setMutation = useMutation(
    trpc.priority.set.mutationOptions({
      onSuccess: () => {
        invalidate()
      },
    }),
  )
  const clearMutation = useMutation(
    trpc.priority.clear.mutationOptions({
      onSuccess: () => {
        invalidate()
      },
    }),
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

  const data = priorityQuery.data
  if (!data) return <Paragraph>{t("Loading priority weeks…")}</Paragraph>

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
      <Paragraph>
        {t(
          "Each main owner group picks one peak week. You can only edit your own column; everyone else's choices are visible but read-only.",
        )}
      </Paragraph>

      <YearNavigator year={year} onChange={setYear} />

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
        <>
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
        </>
      )}

      {lastError && (
        <Paragraph role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </Paragraph>
      )}
    </div>
  )
}
