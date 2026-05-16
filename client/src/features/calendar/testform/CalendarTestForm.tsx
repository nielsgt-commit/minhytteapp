import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

type Mode = "individual" | "group"

type Status = "pending" | "confirmed" | "cancelled"

function seasonYear(now: Date) {
  const y = now.getFullYear()
  return now.getMonth() > 7 ? y + 1 : y
}
const SEASON_YEAR = seasonYear(new Date())
const SEASON_MIN = `${String(SEASON_YEAR)}-05-01`
const SEASON_MAX = `${String(SEASON_YEAR)}-08-31`

type Room = {
  id: number
  name: string
  structure_id: number
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

type OccupantRecord = {
  user_id: number
  room_id: number | null
}

type BookingEditRecord = {
  id: number
  booker_id: number
  start_date: string
  end_date: string
  status: Status
  notes: string | null
  occupants: OccupantRecord[]
}

type FormState = {
  id: number | null
  start_date: string
  end_date: string
  status: Status
  notes: string
  mode: Mode
  individual_room_id: string
  group_user_ids: number[]
  group_assignments: Record<number, string>
}

const initialFormState: FormState = {
  id: null,
  start_date: "",
  end_date: "",
  status: "pending",
  notes: "",
  mode: "individual",
  individual_room_id: "",
  group_user_ids: [],
  group_assignments: {},
}

type TextField = "start_date" | "end_date" | "notes"

type FormAction =
  | { type: "setField"; field: TextField; value: string }
  | { type: "setStatus"; status: Status }
  | { type: "setMode"; mode: Mode }
  | { type: "setIndividualRoom"; roomId: string }
  | { type: "setGroupUsers"; userIds: number[] }
  | { type: "setGroupAssignment"; userId: number; roomId: string }
  | { type: "loadForEdit"; record: BookingEditRecord }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "setStatus":
      return { ...state, status: action.status }
    case "setMode":
      return { ...state, mode: action.mode }
    case "setIndividualRoom":
      return { ...state, individual_room_id: action.roomId }
    case "setGroupUsers": {
      const next: Record<number, string> = {}
      for (const uid of action.userIds) {
        next[uid] = state.group_assignments[uid] ?? ""
      }
      return {
        ...state,
        group_user_ids: action.userIds,
        group_assignments: next,
      }
    }
    case "setGroupAssignment":
      return {
        ...state,
        group_assignments: {
          ...state.group_assignments,
          [action.userId]: action.roomId,
        },
      }
    case "loadForEdit": {
      const r = action.record
      const isIndividual =
        r.occupants.length === 1 && r.occupants[0].user_id === r.booker_id
      if (isIndividual) {
        return {
          ...initialFormState,
          id: r.id,
          start_date: r.start_date,
          end_date: r.end_date,
          status: r.status,
          notes: r.notes ?? "",
          mode: "individual",
          individual_room_id:
            r.occupants[0].room_id != null
              ? String(r.occupants[0].room_id)
              : "",
        }
      }
      const group_user_ids = r.occupants.map(o => o.user_id)
      const group_assignments: Record<number, string> = {}
      for (const o of r.occupants) {
        group_assignments[o.user_id] =
          o.room_id != null ? String(o.room_id) : ""
      }
      return {
        ...initialFormState,
        id: r.id,
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status,
        notes: r.notes ?? "",
        mode: "group",
        group_user_ids,
        group_assignments,
      }
    }
    case "reset":
      return initialFormState
  }
}

function totalBeds(r: Room) {
  return (
    r.beds_sm +
    r.beds_lg +
    r.beds_double * 2 +
    r.beds_kid +
    r.mattresses +
    r.travel_cot
  )
}

function roomLabel(r: Room) {
  const total = totalBeds(r)
  return `${r.name} (${String(total)}/${String(total)})`
}

type OccupantPayload = {
  user_id: number
  room_id: number | null
}

function buildOccupants(
  state: FormState,
  bookerId: number,
): OccupantPayload[] {
  if (state.mode === "individual") {
    const roomId =
      state.individual_room_id !== ""
        ? Number(state.individual_room_id)
        : null
    return [{ user_id: bookerId, room_id: roomId }]
  }

  const userIds = [...new Set([bookerId, ...state.group_user_ids])]
  return userIds.map(uid => {
    const raw = state.group_assignments[uid] ?? ""
    return {
      user_id: uid,
      room_id: raw !== "" ? Number(raw) : null,
    }
  })
}

export function CalendarTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedUserId = useAppSelector(selectSelectedUserId)
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: bookings } = useSuspenseQuery(
    selectedPropertyId != null
      ? trpc.booking.listForProperty.queryOptions({
          property_id: selectedPropertyId,
        })
      : trpc.booking.list.queryOptions(),
  )
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())
  const { data: structures } = useSuspenseQuery(
    trpc.structure.list.queryOptions(),
  )
  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())

  const propertyBookings =
    selectedPropertyId != null
      ? bookings.filter(b => b.property_id === selectedPropertyId)
      : []

  const propertyStructureIds = new Set(
    selectedPropertyId != null
      ? structures
          .filter(b => b.property_id === selectedPropertyId)
          .map(b => b.id)
      : [],
  )
  const propertyRooms = rooms.filter(r =>
    propertyStructureIds.has(r.structure_id),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.booking.pathKey() })

  const createMutation = useMutation(
    trpc.booking.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.booking.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.booking.delete.mutationOptions({
      onSuccess: () => {
        void invalidate()
      },
    }),
  )

  const isEditing = state.id != null
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending
  const lastError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error

  const setText = (field: TextField) => (value: string) => {
    dispatch({ type: "setField", field, value })
  }

  const canSubmit = selectedUserId != null && selectedPropertyId != null

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedUserId == null || selectedPropertyId == null) return
    const occupants = buildOccupants(state, selectedUserId)
    const base = {
      property_id: selectedPropertyId,
      booker_id: selectedUserId,
      start_date: state.start_date,
      end_date: state.end_date,
      status: state.status,
      notes: state.notes.trim() !== "" ? state.notes : null,
      occupants,
    }
    if (state.id == null) {
      createMutation.mutate(base)
    } else {
      updateMutation.mutate({ id: state.id, ...base })
    }
  }

  return (
    <section>
      <h3>Calendar Test Form</h3>

      {selectedUserId == null && (
        <p role="alert">No user selected — pick one from the header.</p>
      )}
      {selectedPropertyId == null && (
        <p role="alert">No property selected — pick one from the header.</p>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>
            {isEditing ? `Editing #${String(state.id)}` : "New booking"}
          </legend>

          <div>
            <label>
              Start date
              <input
                type="date"
                value={state.start_date}
                min={SEASON_MIN}
                max={SEASON_MAX}
                onChange={e => {
                  setText("start_date")(e.target.value)
                }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              End date
              <input
                type="date"
                value={state.end_date}
                min={state.start_date || SEASON_MIN}
                max={SEASON_MAX}
                onChange={e => {
                  setText("end_date")(e.target.value)
                }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Status
              <select
                value={state.status}
                onChange={e => {
                  dispatch({
                    type: "setStatus",
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
              Notes
              <input
                type="text"
                value={state.notes}
                onChange={e => {
                  setText("notes")(e.target.value)
                }}
              />
            </label>
          </div>

          <div>
            <label>
              Booking type
              <select
                value={state.mode}
                onChange={e => {
                  dispatch({ type: "setMode", mode: e.target.value as Mode })
                }}
              >
                <option value="individual">Individual</option>
                <option value="group">Group</option>
              </select>
            </label>
          </div>

          {state.mode === "individual" && (
            <div>
              <label>
                Room
                <select
                  value={state.individual_room_id}
                  onChange={e => {
                    dispatch({
                      type: "setIndividualRoom",
                      roomId: e.target.value,
                    })
                  }}
                >
                  <option value="">(select room)</option>
                  {propertyRooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {roomLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {state.mode === "group" && (
            <>
              <div>
                <label>
                  Users
                  <select
                    multiple
                    value={state.group_user_ids.map(String)}
                    onChange={e => {
                      const ids = Array.from(e.target.selectedOptions).map(o =>
                        Number(o.value),
                      )
                      dispatch({ type: "setGroupUsers", userIds: ids })
                    }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        #{u.id} {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {state.group_user_ids.map(uid => {
                const user = users.find(u => u.id === uid)
                return (
                  <div key={uid}>
                    <label>
                      Room for #{uid} {user ? user.name : ""}
                      <select
                        value={state.group_assignments[uid] ?? ""}
                        onChange={e => {
                          dispatch({
                            type: "setGroupAssignment",
                            userId: uid,
                            roomId: e.target.value,
                          })
                        }}
                      >
                        <option value="">(select room)</option>
                        {propertyRooms.map(r => (
                          <option key={r.id} value={r.id}>
                            {roomLabel(r)}
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
            <button type="submit" disabled={pending || !canSubmit}>
              {isEditing ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "reset" })
              }}
              disabled={pending}
            >
              Reset
            </button>
          </div>
        </fieldset>
      </form>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      <h4>Bookings</h4>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>property</th>
            <th>booker</th>
            <th>start</th>
            <th>end</th>
            <th>status</th>
            <th>occupants</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {propertyBookings.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.property_id}</td>
              <td>
                {b.booker_id}
                {b.booker_name ? ` (${b.booker_name})` : ""}
              </td>
              <td>{b.start_date}</td>
              <td>{b.end_date}</td>
              <td>{b.status}</td>
              <td>
                {b.occupants
                  .map(
                    o =>
                      `${o.user_name ?? `#${String(o.user_id)}`}${o.room_id != null ? ` → r#${String(o.room_id)}` : ""}`,
                  )
                  .join(", ")}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "loadForEdit",
                      record: {
                        id: b.id,
                        booker_id: b.booker_id,
                        start_date: b.start_date,
                        end_date: b.end_date,
                        status: b.status,
                        notes: b.notes,
                        occupants: b.occupants.map(o => ({
                          user_id: o.user_id,
                          room_id: o.room_id,
                        })),
                      },
                    })
                  }}
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteMutation.mutate({ id: b.id })
                  }}
                  disabled={pending}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}