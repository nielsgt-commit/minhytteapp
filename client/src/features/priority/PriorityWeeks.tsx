import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import {
  PEAK_WEEKS,
  type PeakWeek,
  buildOwnerLookups,
  defaultYear,
} from "@/features/priority/priorityUtils"
import { YearNavigator } from "@/features/priority/YearNavigator"
import { PriorityWeeksTable } from "@/features/priority/PriorityWeeksTable"
import { usePrioritySliceSync } from "@/features/priority/usePrioritySliceSync"

export function PriorityWeeks() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const [year, setYear] = useState<number>(defaultYear())

  const { data: me } = useQuery(trpc.user.me.queryOptions())

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
    trpc.priority.set.mutationOptions({ onSuccess: () => { invalidate() } }),
  )
  const clearMutation = useMutation(
    trpc.priority.clear.mutationOptions({
      onSuccess: () => { invalidate() },
    }),
  )
  const { pending, error: lastError } = useMutationsStatus(
    setMutation,
    clearMutation,
  )

  if (selectedPropertyId == null) {
    return <Paragraph>Select a property to manage priority weeks.</Paragraph>
  }

  const data = priorityQuery.data
  if (!data) return <Paragraph>Loading priority weeks…</Paragraph>

  const { eligibleOwners, assignments } = data
  const lookups = buildOwnerLookups(eligibleOwners, assignments)
  const myOwnerRow = me
    ? eligibleOwners.find(o => o.user_id === me.id)
    : undefined
  const myOwnerId = myOwnerRow?.property_owner_id ?? null
  const isAdmin = me?.is_admin === true

  const unassigned = PEAK_WEEKS.filter(
    w => (lookups.ownersByWeek.get(w)?.length ?? 0) === 0,
  )

  const handleAssign = (ownerId: number, week: PeakWeek) => {
    setMutation.mutate({
      property_id: selectedPropertyId,
      property_owner_id: ownerId,
      year,
      iso_week: week,
    })
  }

  const handleClear = (ownerId: number) => {
    clearMutation.mutate({
      property_id: selectedPropertyId,
      property_owner_id: ownerId,
      year,
    })
  }

  return (
    <section>
      <Heading level={3}>Priority weeks (peak summer)</Heading>

      <Paragraph>
        Each household head picks one peak week. You can only edit your own
        column; everyone else&apos;s choices are visible but read-only.
      </Paragraph>

      <YearNavigator year={year} onChange={setYear} />

      {myOwnerId == null && !isAdmin && (
        <Paragraph>
          You don&apos;t have an editable column here. Either you&apos;re not
          an owner of this property, or you haven&apos;t flagged yourself as a
          household head in user settings.
        </Paragraph>
      )}

      {eligibleOwners.length === 0 ? (
        <Paragraph role="alert">
          No household heads found for this property. Owners must enable the
          &quot;household head&quot; flag in their user settings before they
          can be assigned a priority week.
        </Paragraph>
      ) : (
        <>
          {unassigned.length > 0 && (
            <Paragraph role="status">
              {unassigned.length} of {PEAK_WEEKS.length} peak weeks still
              unassigned (W{unassigned.join(", W")}).
            </Paragraph>
          )}

          <PriorityWeeksTable
            year={year}
            eligibleOwners={eligibleOwners}
            lookups={lookups}
            meUserId={me?.id}
            myOwnerId={myOwnerId}
            isAdmin={isAdmin}
            pending={pending}
            onAssign={handleAssign}
            onClear={handleClear}
          />
        </>
      )}

      {lastError && <Paragraph role="alert">Error: {lastError.message}</Paragraph>}
    </section>
  )
}
