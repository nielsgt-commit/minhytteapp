import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type RoomType = "single" | "double" | "family"

type RoomRecord = {
  id: number
  name: string
  building_id: number
  building_name: string | null
  beds_sm: number
  beds_lg: number
  beds_double: number
  mattresses: number
  travel_cot: number
  room_type: RoomType
}

type FormState = {
  id: number | null
  name: string
  building_id: string
  beds_sm: string
  beds_lg: string
  beds_double: string
  mattresses: string
  travel_cot: string
  room_type: RoomType
}

const ROOM_TYPES: RoomType[] = ["single", "double", "family"]

const initialFormState: FormState = {
  id: null,
  name: "",
  building_id: "",
  beds_sm: "0",
  beds_lg: "0",
  beds_double: "0",
  mattresses: "0",
  travel_cot: "0",
  room_type: "single",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "loadForEdit"; record: RoomRecord }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "loadForEdit": {
      const r = action.record
      return {
        id: r.id,
        name: r.name,
        building_id: String(r.building_id),
        beds_sm: String(r.beds_sm),
        beds_lg: String(r.beds_lg),
        beds_double: String(r.beds_double),
        mattresses: String(r.mattresses),
        travel_cot: String(r.travel_cot),
        room_type: r.room_type,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    name: state.name,
    building_id: Number(state.building_id),
    beds_sm: Number(state.beds_sm),
    beds_lg: Number(state.beds_lg),
    beds_double: Number(state.beds_double),
    mattresses: Number(state.mattresses),
    travel_cot: Number(state.travel_cot),
    room_type: state.room_type,
  }
}

export function RoomsTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.room.list.queryKey() })

  const createMutation = useMutation(
    trpc.room.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.room.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.room.delete.mutationOptions({
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

  const set = (field: EditableField) => (value: string) =>
    { dispatch({ type: "setField", field, value }); }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload = buildPayload(state)
    if (state.id == null) {
      createMutation.mutate(payload)
    } else {
      updateMutation.mutate({ id: state.id, ...payload })
    }
  }

  return (
    <section>
      <h3>Rooms Test Form</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>{isEditing ? `Editing #${String(state.id)}` : "New record"}</legend>

          <div>
            <label>
              Name
              <input
                type="text"
                value={state.name}
                onChange={e => { set("name")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Building
              <select
                value={state.building_id}
                onChange={e => { set("building_id")(e.target.value); }}
                required
              >
                <option value="">(select building)</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>
                    #{b.id} {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>
              Room type
              <select
                value={state.room_type}
                onChange={e => { set("room_type")(e.target.value); }}
              >
                {ROOM_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>
              Beds (single)
              <input
                type="number"
                min={0}
                value={state.beds_sm}
                onChange={e => { set("beds_sm")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Beds (large)
              <input
                type="number"
                min={0}
                value={state.beds_lg}
                onChange={e => { set("beds_lg")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Beds (double)
              <input
                type="number"
                min={0}
                value={state.beds_double}
                onChange={e => { set("beds_double")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Mattresses
              <input
                type="number"
                min={0}
                value={state.mattresses}
                onChange={e => { set("mattresses")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Travel cot
              <input
                type="number"
                min={0}
                value={state.travel_cot}
                onChange={e => { set("travel_cot")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <button type="submit" disabled={pending}>
              {isEditing ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { dispatch({ type: "reset" }); }}
              disabled={pending}
            >
              Reset
            </button>
          </div>
        </fieldset>
      </form>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      <h4>Records</h4>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>name</th>
            <th>building</th>
            <th>type</th>
            <th>beds_sm</th>
            <th>beds_lg</th>
            <th>beds_double</th>
            <th>mattresses</th>
            <th>travel_cot</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td>
                #{r.building_id} {r.building_name ?? ""}
              </td>
              <td>{r.room_type}</td>
              <td>{r.beds_sm}</td>
              <td>{r.beds_lg}</td>
              <td>{r.beds_double}</td>
              <td>{r.mattresses}</td>
              <td>{r.travel_cot}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    { dispatch({
                      type: "loadForEdit",
                      record: r as RoomRecord,
                    }); }
                  }
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { deleteMutation.mutate({ id: r.id }); }}
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
