import { useEffect, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Heading,
  Paragraph,
  Radio,
  Table,
} from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import {
  type PriorityWeekHolder,
  setPriorityYearAssignments,
} from "@/features/priority/prioritySlice"

type PeakWeek = 28 | 29 | 30
const PEAK_WEEKS: PeakWeek[] = [28, 29, 30]

type WeekRange = { start: Date; end: Date }

function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1))
  const target = new Date(week1Monday)
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return target
}

function peakWeekRange(year: number, week: PeakWeek): WeekRange {
  const start = isoWeekMonday(year, week)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { start, end }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function formatRange(r: WeekRange): string {
  return `${formatDate(r.start)} – ${formatDate(r.end)}`
}

function defaultYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 8 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
}

export function PriorityWeeks() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const dispatch = useAppDispatch()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const [year, setYear] = useState<number>(defaultYear())

  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const priorityQuery = useQuery({
    ...trpc.priority.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
      year,
    }),
    enabled: selectedPropertyId != null,
  })

  useEffect(() => {
    const data = priorityQuery.data
    if (!data) return
    const ownerById = new Map(
      data.eligibleOwners.map(o => [
        o.property_owner_id,
        { userId: o.user_id, userName: o.user_name },
      ]),
    )
    const next: Record<number, PriorityWeekHolder> = {}
    for (const a of data.assignments) {
      const owner = ownerById.get(a.property_owner_id)
      if (!owner) continue
      next[a.iso_week] = {
        ownerId: a.property_owner_id,
        userId: owner.userId,
        userName: owner.userName,
      }
    }
    dispatch(setPriorityYearAssignments({ year, assignments: next }))
  }, [priorityQuery.data, year, dispatch])

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

  if (selectedPropertyId == null) {
    return <Paragraph>Select a property to manage priority weeks.</Paragraph>
  }

  const data = priorityQuery.data
  if (!data) return <Paragraph>Loading priority weeks…</Paragraph>

  const eligibleOwners = data.eligibleOwners
  const assignments = data.assignments

  const ownersByWeek = new Map<PeakWeek, number[]>()
  for (const a of assignments) {
    if (a.iso_week === 28 || a.iso_week === 29 || a.iso_week === 30) {
      const list = ownersByWeek.get(a.iso_week) ?? []
      list.push(a.property_owner_id)
      ownersByWeek.set(a.iso_week, list)
    }
  }

  const myOwnerRow = me
    ? eligibleOwners.find(o => o.user_id === me.id)
    : undefined
  const myOwnerId = myOwnerRow?.property_owner_id ?? null
  const isAdmin = me?.is_admin === true

  const ownerNameById = new Map<number, string>()
  for (const o of eligibleOwners) {
    ownerNameById.set(o.property_owner_id, o.user_name)
  }

  const unassigned = PEAK_WEEKS.filter(w => (ownersByWeek.get(w)?.length ?? 0) === 0)
  const pending = setMutation.isPending || clearMutation.isPending
  const lastError = setMutation.error ?? clearMutation.error

  return (
    <section>
      <Heading level={3}>Priority weeks (peak summer)</Heading>

      <Paragraph>
        Each household head picks one peak week. You can only edit your own
        column; everyone else&apos;s choices are visible but read-only.
      </Paragraph>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Button type="button" variant="tertiary" data-size="sm" onClick={() => { setYear(y => y - 1) }}>
          Prev
        </Button>
        <span> {year} </span>
        <Button type="button" variant="tertiary" data-size="sm" onClick={() => { setYear(y => y + 1) }}>
          Next
        </Button>
      </div>

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

          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Week</Table.HeaderCell>
                <Table.HeaderCell>Dates</Table.HeaderCell>
                {eligibleOwners.map(o => (
                  <Table.HeaderCell key={o.property_owner_id}>
                    {o.user_name}
                    {o.user_id === me?.id ? " (you)" : ""}
                  </Table.HeaderCell>
                ))}
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {PEAK_WEEKS.map(week => {
                const range = peakWeekRange(year, week)
                const ownersForWeek = ownersByWeek.get(week) ?? []
                return (
                  <Table.Row key={week}>
                    <Table.Cell>W{week}</Table.Cell>
                    <Table.Cell>{formatRange(range)}</Table.Cell>
                    {eligibleOwners.map(o => {
                      const checked = ownersForWeek.includes(o.property_owner_id)
                      const isMyColumn = o.user_id === me?.id
                      const editable = (isMyColumn || isAdmin) && !pending
                      return (
                        <Table.Cell key={o.property_owner_id}>
                          <Radio
                            label=""
                            aria-label={`W${week} – ${o.user_name}`}
                            name={`priority-week-owner-${String(o.property_owner_id)}`}
                            value={String(week)}
                            checked={checked}
                            disabled={!editable}
                            onChange={() => {
                              setMutation.mutate({
                                property_id: selectedPropertyId,
                                property_owner_id: o.property_owner_id,
                                year,
                                iso_week: week,
                              })
                            }}
                          />
                        </Table.Cell>
                      )
                    })}
                    <Table.Cell>
                      {ownersForWeek.length > 0 && (isAdmin || (myOwnerId != null && ownersForWeek.includes(myOwnerId))) && (
                        <Button
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          disabled={pending}
                          onClick={() => {
                            const targetOwnerId = isAdmin
                              ? ownersForWeek[0]
                              : myOwnerId
                            if (targetOwnerId == null) return
                            clearMutation.mutate({
                              property_id: selectedPropertyId,
                              property_owner_id: targetOwnerId,
                              year,
                            })
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
              {PEAK_WEEKS.flatMap(week => {
                const ownersForWeek = ownersByWeek.get(week) ?? []
                if (ownersForWeek.length <= 1) return []
                const names = ownersForWeek.map(
                  id => ownerNameById.get(id) ?? `#${String(id)}`,
                )
                return [
                  <Table.Row key={`conflict-${String(week)}`}>
                    <Table.Cell colSpan={2 + eligibleOwners.length + 1}>
                      <Paragraph role="alert">
                        Conflict on W{week}: {names.join(" and ")} have both
                        claimed this week. Resolve in person — the system will
                        not pick a winner.
                      </Paragraph>
                    </Table.Cell>
                  </Table.Row>,
                ]
              })}
            </Table.Body>
          </Table>
        </>
      )}

      {lastError && <Paragraph role="alert">Error: {lastError.message}</Paragraph>}
    </section>
  )
}
