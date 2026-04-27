import { useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

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
    return <p>Select a property to manage priority weeks.</p>
  }

  const data = priorityQuery.data
  if (!data) return <p>Loading priority weeks…</p>

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
  const yearOptions = [year - 1, year, year + 1, year + 2]

  return (
    <section>
      <h3>Priority weeks (peak summer)</h3>

      <p>
        Each household head picks one peak week. You can only edit your own
        column; everyone else&apos;s choices are visible but read-only.
      </p>

      <label>
        Year
        <select
          value={year}
          onChange={e => { setYear(Number(e.target.value)) }}
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      {myOwnerId == null && !isAdmin && (
        <p>
          You don&apos;t have an editable column here. Either you&apos;re not
          an owner of this property, or you haven&apos;t flagged yourself as a
          household head in user settings.
        </p>
      )}

      {eligibleOwners.length === 0 ? (
        <p role="alert">
          No household heads found for this property. Owners must enable the
          &quot;household head&quot; flag in their user settings before they
          can be assigned a priority week.
        </p>
      ) : (
        <>
          {unassigned.length > 0 && (
            <p role="status">
              {unassigned.length} of {PEAK_WEEKS.length} peak weeks still
              unassigned (W{unassigned.join(", W")}).
            </p>
          )}

          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Dates</th>
                {eligibleOwners.map(o => (
                  <th key={o.property_owner_id}>
                    {o.user_name}
                    {o.user_id === me?.id ? " (you)" : ""}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {PEAK_WEEKS.map(week => {
                const range = peakWeekRange(year, week)
                const ownersForWeek = ownersByWeek.get(week) ?? []
                return (
                  <tr key={week}>
                    <td>W{week}</td>
                    <td>{formatRange(range)}</td>
                    {eligibleOwners.map(o => {
                      const checked = ownersForWeek.includes(o.property_owner_id)
                      const isMyColumn = o.user_id === me?.id
                      const editable = (isMyColumn || isAdmin) && !pending
                      return (
                        <td key={o.property_owner_id}>
                          <input
                            type="radio"
                            name={`priority-week-owner-${String(o.property_owner_id)}`}
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
                        </td>
                      )
                    })}
                    <td>
                      {ownersForWeek.length > 0 && (isAdmin || (myOwnerId != null && ownersForWeek.includes(myOwnerId))) && (
                        <button
                          type="button"
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
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {PEAK_WEEKS.flatMap(week => {
                const ownersForWeek = ownersByWeek.get(week) ?? []
                if (ownersForWeek.length <= 1) return []
                const names = ownersForWeek.map(
                  id => ownerNameById.get(id) ?? `#${String(id)}`,
                )
                return [
                  <tr key={`conflict-${String(week)}`}>
                    <td colSpan={2 + eligibleOwners.length + 1}>
                      <p role="alert">
                        Conflict on W{week}: {names.join(" and ")} have both
                        claimed this week. Resolve in person — the system will
                        not pick a winner.
                      </p>
                    </td>
                  </tr>,
                ]
              })}
            </tbody>
          </table>
        </>
      )}

      {lastError && <p role="alert">Error: {lastError.message}</p>}
    </section>
  )
}
