import { useEffect, useMemo, useRef, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Field,
  Fieldset,
  Heading,
  Label,
  Paragraph,
  Select,
  Table,
  Tag,
  Textfield,
} from "@digdir/designsystemet-react"
import flatpickr from "flatpickr"
import weekSelectPlugin from "flatpickr/dist/plugins/weekSelect/weekSelect"
import type { Plugin } from "flatpickr/dist/types/options"
import "flatpickr/dist/flatpickr.min.css"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { selectPriorityHolderForWeek } from "@/features/priority/prioritySlice"

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

const TEST_MIN_WEEK = 28
const TEST_MAX_WEEK = 30
const TEST_YEAR = new Date().getFullYear()

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

function sundayBeforeIsoWeek(year: number, week: number) {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay()
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() - 1)
  sunday.setHours(0, 0, 0, 0)
  return sunday
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
        <Heading level={4}>Experimental Week Panel</Heading>
        <Paragraph role="alert">No property selected — pick one from the header.</Paragraph>
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
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const [weekStart, setWeekStart] = useState(() =>
    sundayBeforeIsoWeek(TEST_YEAR, TEST_MIN_WEEK),
  )
  const [picks, setPicks] = useState<Record<number, string[]>>({})
  const [drafts, setDrafts] = useState<Record<string, DraftConfig>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const weekPickerRef = useRef<HTMLInputElement>(null)
  const flatpickrRef = useRef<flatpickr.Instance | null>(null)

  useEffect(() => {
    if (!weekPickerRef.current) return
    const fp = flatpickr(weekPickerRef.current, {
      plugins: [weekSelectPlugin() as Plugin],
      minDate: sundayBeforeIsoWeek(TEST_YEAR, TEST_MIN_WEEK),
      maxDate: addDays(sundayBeforeIsoWeek(TEST_YEAR, TEST_MAX_WEEK), 6),
      onChange: dates => {
        if (dates[0]) {
          const sunday = new Date(dates[0])
          sunday.setHours(0, 0, 0, 0)
          sunday.setDate(sunday.getDate() - sunday.getDay())
          setWeekStart(sunday)
        }
      },
    })
    flatpickrRef.current = fp
    return () => {
      fp.destroy()
      flatpickrRef.current = null
    }
  }, [])

  useEffect(() => {
    flatpickrRef.current?.setDate(weekStart, false)
  }, [weekStart])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekNumber = isoWeekNumber(addDays(weekStart, 4))
  const isoYear = addDays(weekStart, 4).getFullYear()
  const priorityHolder = useAppSelector(state =>
    selectPriorityHolderForWeek(state, isoYear, weekNumber),
  )

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

  const bookingIdByUserDay = useMemo(() => {
    const map = new Map<number, Map<string, number>>()
    for (const b of bookings) {
      if (b.property_id !== propertyId) continue
      if (b.status === "cancelled") continue
      let cur = fromIso(b.start_date)
      const end = fromIso(b.end_date)
      while (cur <= end) {
        const iso = toIso(cur)
        for (const o of b.occupants) {
          let inner = map.get(o.user_id)
          if (inner == null) {
            inner = new Map<string, number>()
            map.set(o.user_id, inner)
          }
          if (!inner.has(iso)) inner.set(iso, b.id)
        }
        cur = addDays(cur, 1)
      }
    }
    return map
  }, [bookings, propertyId])

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
        void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.booking.delete.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })
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
      <Heading level={4}>Experimental Week Panel</Heading>

      {selectedUserId == null && (
        <Paragraph role="alert">No user selected — pick one from the header.</Paragraph>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Button
          variant="secondary"
          disabled={weekNumber <= TEST_MIN_WEEK}
          onClick={() => {
            setWeekStart(prev => addDays(prev, -7))
          }}
        >
          Prev week
        </Button>
        <input ref={weekPickerRef} type="text" aria-label="Pick week" />
        <Paragraph>Week {weekNumber}</Paragraph>
        <Button
          variant="secondary"
          disabled={weekNumber >= TEST_MAX_WEEK}
          onClick={() => {
            setWeekStart(prev => addDays(prev, 7))
          }}
        >
          Next week
        </Button>
        {priorityHolder && <Tag>Priority: {priorityHolder.userName}</Tag>}
      </div>

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>User</Table.HeaderCell>
            {days.map((d, i) => (
              <Table.HeaderCell key={toIso(d)}>
                <div>{WEEKDAY_LABELS[i]}</div>
                <div>{pad2(d.getDate())}/{pad2(d.getMonth() + 1)}</div>
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Head>
        {rowGroups.map(group => (
          <Table.Body key={group.key}>
            <Table.Row>
              <Table.HeaderCell colSpan={8} scope="colgroup">
                {group.label}
              </Table.HeaderCell>
            </Table.Row>
            {group.members.map(u => {
              const isCurrent = u.id === selectedUserId
              const userPicks = picks[u.id] ?? []
              return (
                <Table.Row key={u.id}>
                  <Table.HeaderCell scope="row">
                    {u.name}
                    {u.is_head ? " (head)" : ""}
                  </Table.HeaderCell>
                  {days.map(d => {
                    const iso = toIso(d)
                    const bookingId =
                      bookingIdByUserDay.get(u.id)?.get(iso) ?? null
                    const isBooked = bookingId != null
                    return (
                      <Table.Cell key={iso}>
                        <input
                          type="checkbox"
                          checked={isBooked || userPicks.includes(iso)}
                          disabled={!isCurrent || deleteMutation.isPending}
                          onChange={() => {
                            if (bookingId != null) {
                              if (
                                window.confirm(
                                  "Remove the booking covering this day?",
                                )
                              ) {
                                deleteMutation.mutate({ id: bookingId })
                              }
                              return
                            }
                            togglePick(u.id, iso)
                          }}
                        />
                      </Table.Cell>
                    )
                  })}
                </Table.Row>
              )
            })}
          </Table.Body>
        ))}
      </Table>

      <Heading level={4}>Convert picks to bookings</Heading>
      {ranges.length === 0 && (
        <Paragraph>Pick days above to derive booking ranges.</Paragraph>
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
          <Fieldset key={range.start}>
            <Fieldset.Legend>
              {range.start} – {range.end} ({String(dayCount)}{" "}
              {dayCount === 1 ? "day" : "days"})
            </Fieldset.Legend>

            <Field>
              <Label>Status</Label>
              <Select
                value={draft.status}
                onChange={e => {
                  setDraft(range.start, {
                    status: e.target.value as Status,
                  })
                }}
              >
                <Select.Option value="pending">pending</Select.Option>
                <Select.Option value="confirmed">confirmed</Select.Option>
                <Select.Option value="cancelled">cancelled</Select.Option>
              </Select>
            </Field>

            <Field>
              <Label>Booking type</Label>
              <Select
                value={draft.mode}
                onChange={e => {
                  setDraft(range.start, {
                    mode: e.target.value as Mode,
                  })
                }}
              >
                <Select.Option value="individual">Individual</Select.Option>
                <Select.Option value="group">Group</Select.Option>
              </Select>
            </Field>

            {draft.mode === "individual" && (
              <Field>
                <Label>Room</Label>
                <Select
                  value={draft.room_id}
                  onChange={e => {
                    setDraft(range.start, { room_id: e.target.value })
                  }}
                >
                  <Select.Option value="">(no room)</Select.Option>
                  {propertyRooms.map(r => (
                    <Select.Option key={r.id} value={r.id}>
                      {r.name}
                    </Select.Option>
                  ))}
                </Select>
              </Field>
            )}

            {draft.mode === "group" && (
              <>
                <Field>
                  <Label htmlFor={`other-occupants-${range.start}`}>
                    Other occupants
                  </Label>
                  <select
                    id={`other-occupants-${range.start}`}
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
                </Field>

                {groupRoster.map(uid => {
                  const u = users.find(x => x.id === uid)
                  return (
                    <Field key={uid}>
                      <Label>Room for #{uid} {u ? u.name : ""}</Label>
                      <Select
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
                        <Select.Option value="">(no room)</Select.Option>
                        {propertyRooms.map(r => (
                          <Select.Option key={r.id} value={r.id}>
                            {r.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Field>
                  )
                })}
              </>
            )}

            <Textfield
              label="Notes"
              value={draft.notes}
              onChange={e => {
                setDraft(range.start, { notes: e.target.value })
              }}
            />

            <Button
              disabled={
                selectedUserId == null || createMutation.isPending
              }
              onClick={() => {
                submitRange(range)
              }}
            >
              Create booking
            </Button>

            {err !== undefined && (
              <Paragraph data-color="danger" role="alert">
                Error: {err}
              </Paragraph>
            )}
          </Fieldset>
        )
      })}
    </section>
  )
}
