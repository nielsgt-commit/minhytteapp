import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Tag } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import AvailabilityIndicatorBadge
  from "@/features/dashboard/calendarsummary/plannedavailability/availabilityindicatorbadge/AvailabilityIndicatorBadge.tsx"

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toIso(d: Date) {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfSunday(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

function addDays(d: Date, n: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function isoWeekNumber(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function isoWeekYear(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  return t.getUTCFullYear()
}

export default function PlannedAvailabilitySummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: rooms } = useSuspenseQuery(
    trpc.room.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const totalBeds = rooms.reduce(
    (sum, r) =>
      sum +
      r.beds_sm +
      r.beds_lg +
      r.beds_double * 2 +
      r.beds_kid +
      r.mattresses +
      r.travel_cot,
    0,
  )
  const [weekStart, setWeekStart] = useState(() => startOfSunday(new Date()))

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const thursday = addDays(weekStart, 4)
  const weekNumber = isoWeekNumber(thursday)
  const weekYear = isoWeekYear(thursday)

  const { data: priority } = useSuspenseQuery(
    trpc.priority.list.queryOptions({
      property_id: propertyId,
      year: weekYear,
    }),
  )
  const priorityHolderName = (() => {
    const a = priority.assignments.find(x => x.iso_week === weekNumber)
    if (!a) return null
    const o = priority.eligibleOwners.find(
      x => x.property_owner_id === a.property_owner_id,
    )
    return o?.user_name ?? null
  })()

  const propertyBookings = bookings.filter(b => b.status !== "cancelled")

  const guestsOnDay = (iso: string) => {
    let count = 0
    for (const b of propertyBookings) {
      if (iso >= b.start_date && iso <= b.end_date) {
        count += b.occupants.length
      }
    }
    return count
  }

  return (
    <>
      <div className="calendar-week-nav">
        <button
          type="button"
          onClick={() => {
            setWeekStart(prev => addDays(prev, -7))
          }}
        >
          Previous week
        </button>
        <span> Week {weekNumber} </span>
        <button
          type="button"
          onClick={() => {
            setWeekStart(prev => addDays(prev, 7))
          }}
        >
          Next week
        </button>
        {priorityHolderName && <Tag>{priorityHolderName}</Tag>}
      </div>
      <div className="calendar-week-chips"></div>

      <div className="calendar-week-days">
        <table>
          <thead>
            <tr>
              {days.map((d, i) => (
                <th key={toIso(d)} scope="col">{WEEKDAY_LABELS[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {days.map(d => (
                <td key={toIso(d)}>
                  {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                </td>
              ))}
            </tr>
            <tr>
              {days.map(d => {
                const iso = toIso(d)
                return (
                  <td key={iso}>
                    <AvailabilityIndicatorBadge count={guestsOnDay(iso)} totalBeds={totalBeds} />
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
