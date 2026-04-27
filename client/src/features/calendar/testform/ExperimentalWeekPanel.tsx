import { useMemo, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

type Status = "pending" | "confirmed" | "cancelled"
type Mode = "individual" | "group"

type DraftConfig = {
  status: Status
  mode: Mode
  room_id: string
  group_user_ids: number[]
  group_assignments: Record<number, string>
  notes: string
}

const DEFAULT_DRAFT: DraftConfig = {
  status: "pending",
  mode: "individual",
  room_id: "",
  group_user_ids: [],
  group_assignments: {},
  notes: "",
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

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toIso(d: Date) {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fromIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function isoWeekNumber(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

type Range = { start: string; end: string; days: string[] }

function groupConsecutive(isos: string[]): Range[] {
  const sorted = [...new Set(isos)].sort()
  if (sorted.length === 0) return []
  const out: Range[] = []
  let cur: Range = { start: sorted[0], end: sorted[0], days: [sorted[0]] }
  for (let i = 1; i < sorted.length; i++) {
    const iso = sorted[i]
    const expected = toIso(addDays(fromIso(cur.end), 1))
    if (iso === expected) {
      cur.end = iso
      cur.days.push(iso)
    } else {
      out.push(cur)
      cur = { start: iso, end: iso, days: [iso] }
    }
  }
  out.push(cur)
  return out
}

export function ExperimentalWeekPanel() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  if (selectedPropertyId == null) {
    return (
      <section>
        <h3>Experimental Week Panel</h3>
        <p role="alert">No property selected — pick one from the header.</p>
      </section>
    )
  }
  return <Body propertyId={selectedPropertyId} />
}

function Body({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedUserId = useAppSelector(selectSelectedUserId)

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )
  const { data: owners } = useSuspenseQuery(
    trpc.propertyOwner.list.queryOptions({ property_id: propertyId }),
  )
  const { data: propertyGroups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const [weekStart, setWeekStart] = useState(() => startOfSunday(new Date()))
  const [picks, setPicks] = useState<Record<number, string[]>>({})
  const [drafts, setDrafts] = useState<Record<string, DraftConfig>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekNumber = isoWeekNumber(addDays(weekStart, 4))

  const propertyBuildingIds = new Set(
    buildings.filter(b => b.property_id === propertyId).map(b => b.id),
  )
  const propertyRooms = rooms.filter(r =>
    propertyBuildingIds.has(r.building_id),
  )

  const directOwnerUserIds = useMemo(() => {
    const set = new Set<number>()
    for (const o of owners) {
      if (o.user_id != null) set.add(o.user_id)
    }
    return set
  }, [owners])

  const propertyUsers = useMemo(() => {
    const ids = new Set<number>(directOwnerUserIds)
    for (const g of propertyGroups) {
      for (const m of g.members) ids.add(m.user_id)
    }
    return users.filter(u => ids.has(u.id))
  }, [users, propertyGroups, directOwnerUserIds])

  type Row = (typeof users)[number]
  type RowGroup = { key: string; label: string; members: Row[] }
  const rowGroups = useMemo<RowGroup[]>(() => {
    const out: RowGroup[] = []
    const claimed = new Set<number>()
    const sortHeadFirst = (a: Row, b: Row) => {
      if (a.is_head !== b.is_head) return a.is_head ? -1 : 1
      return a.id - b.id
    }
    for (const g of propertyGroups) {
      const members: Row[] = []
      for (const m of g.members) {
        if (claimed.has(m.user_id)) continue
        const u = users.find(x => x.id === m.user_id)
        if (u == null) continue
        members.push(u)
        claimed.add(u.id)
      }
      if (members.length === 0) continue
      members.sort(sortHeadFirst)
      out.push({ key: `group-${String(g.id)}`, label: g.name, members })
    }
    const directs: Row[] = []
    for (const uid of directOwnerUserIds) {
      if (claimed.has(uid)) continue
      const u = users.find(x => x.id === uid)
      if (u == null) continue
      directs.push(u)
      claimed.add(uid)
    }
    if (directs.length > 0) {
      directs.sort(sortHeadFirst)
      out.push({
        key: "individual-owners",
        label: "Individual owners",
        members: directs,
      })
    }
    return out
  }, [users, propertyGroups, directOwnerUserIds])

  const currentPicks =
    selectedUserId != null ? picks[selectedUserId] ?? [] : []
  const ranges = useMemo(() => groupConsecutive(currentPicks), [currentPicks])

  const togglePick = (userId: number, iso: string) => {
    setPicks(prev => {
      const cur = prev[userId] ?? []
      const next = cur.includes(iso)
        ? cur.filter(d => d !== iso)
        : [...cur, iso]
      return { ...prev, [userId]: next }
    })
  }

  const getDraft = (rangeKey: string): DraftConfig =>
    drafts[rangeKey] ?? DEFAULT_DRAFT

  const setDraft = (rangeKey: string, patch: Partial<DraftConfig>) => {
    setDrafts(prev => ({
      ...prev,
      [rangeKey]: { ...getDraft(rangeKey), ...patch },
    }))
  }

  const createMutation = useMutation(
    trpc.booking.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.booking.list.queryKey() })
      },
    }),
  )

  const submitRange = (range: Range) => {
    if (selectedUserId == null) return
    const draft = getDraft(range.start)

    const roomIdFor = (raw: string | undefined) =>
      raw !== undefined && raw !== "" ? Number(raw) : null

    const occupants =
      draft.mode === "individual"
        ? [
            {
              user_id: selectedUserId,
              room_id: draft.room_id !== "" ? Number(draft.room_id) : null,
            },
          ]
        : [...new Set([selectedUserId, ...draft.group_user_ids])].map(uid => ({
            user_id: uid,
            room_id: roomIdFor(draft.group_assignments[uid]),
          }))

    createMutation.mutate(
      {
        property_id: propertyId,
        booker_id: selectedUserId,
        start_date: range.start,
        end_date: range.end,
        status: draft.status,
        notes: draft.notes.trim() !== "" ? draft.notes : null,
        occupants,
      },
      {
        onSuccess: () => {
          setPicks(prev => {
            const cur = prev[selectedUserId] ?? []
            return {
              ...prev,
              [selectedUserId]: cur.filter(d => !range.days.includes(d)),
            }
          })
          setDrafts(prev => {
            const next = { ...prev }
            delete next[range.start]
            return next
          })
          setErrors(prev => {
            const next = { ...prev }
            delete next[range.start]
            return next
          })
        },
        onError: err => {
          setErrors(prev => ({ ...prev, [range.start]: err.message }))
        },
      },
    )
  }

  return (
    <section>
      <h3>Experimental Week Panel</h3>

      {selectedUserId == null && (
        <p role="alert">No user selected — pick one from the header.</p>
      )}

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
                <div>{pad2(d.getDate())}/{pad2(d.getMonth() + 1)}</div>
              </th>
            ))}
          </tr>
        </thead>
        {rowGroups.map(group => (
          <tbody key={group.key}>
            <tr>
              <th colSpan={8} scope="colgroup">
                {group.label}
              </th>
            </tr>
            {group.members.map(u => {
              const isCurrent = u.id === selectedUserId
              const userPicks = picks[u.id] ?? []
              return (
                <tr key={u.id}>
                  <th scope="row">
                    {u.name}
                    {u.is_head ? " (head)" : ""}
                  </th>
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
        ))}
      </table>

      <h4>Convert picks to bookings</h4>
      {ranges.length === 0 && (
        <p>Pick days above to derive booking ranges.</p>
      )}
      {ranges.map(range => {
        const draft = getDraft(range.start)
        const otherUsers = propertyUsers.filter(u => u.id !== selectedUserId)
        const err = errors[range.start]
        const dayCount = range.days.length
        const groupRoster =
          selectedUserId != null
            ? [...new Set([selectedUserId, ...draft.group_user_ids])]
            : draft.group_user_ids
        return (
          <fieldset key={range.start}>
            <legend>
              {range.start} – {range.end} ({String(dayCount)}{" "}
              {dayCount === 1 ? "day" : "days"})
            </legend>

            <div>
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={e => {
                    setDraft(range.start, {
                      status: e.target.value as Status,
                    })
                  }}
                >
                  <option value="pending">pending</option>
                  <option value="confirmed">confirmed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                Booking type
                <select
                  value={draft.mode}
                  onChange={e => {
                    setDraft(range.start, {
                      mode: e.target.value as Mode,
                    })
                  }}
                >
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                </select>
              </label>
            </div>

            {draft.mode === "individual" && (
              <div>
                <label>
                  Room
                  <select
                    value={draft.room_id}
                    onChange={e => {
                      setDraft(range.start, { room_id: e.target.value })
                    }}
                  >
                    <option value="">(no room)</option>
                    {propertyRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {draft.mode === "group" && (
              <>
                <div>
                  <label>
                    Other occupants
                    <select
                      multiple
                      value={draft.group_user_ids.map(String)}
                      onChange={e => {
                        const ids = Array.from(e.target.selectedOptions).map(
                          o => Number(o.value),
                        )
                        setDraft(range.start, { group_user_ids: ids })
                      }}
                    >
                      {otherUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          #{u.id} {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {groupRoster.map(uid => {
                  const u = users.find(x => x.id === uid)
                  return (
                    <div key={uid}>
                      <label>
                        Room for #{uid} {u ? u.name : ""}
                        <select
                          value={draft.group_assignments[uid] ?? ""}
                          onChange={e => {
                            setDraft(range.start, {
                              group_assignments: {
                                ...draft.group_assignments,
                                [uid]: e.target.value,
                              },
                            })
                          }}
                        >
                          <option value="">(no room)</option>
                          {propertyRooms.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )
                })}
              </>
            )}

            <div>
              <label>
                Notes
                <input
                  type="text"
                  value={draft.notes}
                  onChange={e => {
                    setDraft(range.start, { notes: e.target.value })
                  }}
                />
              </label>
            </div>

            <div>
              <button
                type="button"
                disabled={
                  selectedUserId == null || createMutation.isPending
                }
                onClick={() => {
                  submitRange(range)
                }}
              >
                Create booking
              </button>
            </div>

            {err !== undefined && <p role="alert">Error: {err}</p>}
          </fieldset>
        )
      })}
    </section>
  )
}
