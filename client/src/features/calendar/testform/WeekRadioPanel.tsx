import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

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

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toIso(d: Date) {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function isoWeekNumber(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function WeekRadioPanel() {
  const trpc = useTRPC()
  const selectedUserId = useAppSelector(selectSelectedUserId)
  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const [weekStart, setWeekStart] = useState(() => startOfSunday(new Date()))
  const [picks, setPicks] = useState<Record<number, string[]>>({})

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekNumber = isoWeekNumber(addDays(weekStart, 4))

  const togglePick = (userId: number, iso: string) => {
    setPicks(prev => {
      const current = prev[userId] ?? []
      const next = current.includes(iso)
        ? current.filter(d => d !== iso)
        : [...current, iso]
      return { ...prev, [userId]: next }
    })
  }

  return (
    <section>
      <h3>Week Radio Panel</h3>
      <div>
        <button
          type="button"
          onClick={() => {
            setWeekStart(prev => addDays(prev, -7))
          }}
        >
          Prev week
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
      </div>

      <table>
        <thead>
          <tr>
            <th>User</th>
            {days.map((d, i) => (
              <th key={toIso(d)}>
                <div>{WEEKDAY_LABELS[i]}</div>
                <div>{`${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const isCurrent = u.id === selectedUserId
            const userPicks = picks[u.id] ?? []
            return (
              <tr key={u.id}>
                <th scope="row">{u.name}</th>
                {days.map(d => {
                  const iso = toIso(d)
                  return (
                    <td key={iso}>
                      <input
                        type="checkbox"
                        checked={userPicks.includes(iso)}
                        disabled={!isCurrent}
                        onChange={() => {
                          togglePick(u.id, iso)
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
