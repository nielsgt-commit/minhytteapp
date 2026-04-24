import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type BookingRecord = {
  id: number
  property_id: number
  booker_id: number
  start_date: string
  end_date: string
}

type FormState = {
  id: number | null
  property_id: string
  booker_id: string
  start_date: string
  end_date: string
}

const initialFormState: FormState = {
  id: null,
  property_id: "1",
  booker_id: "1",
  start_date: "",
  end_date: "",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "loadForEdit"; record: BookingRecord }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "loadForEdit": {
      const r = action.record
      return {
        id: r.id,
        property_id: String(r.property_id),
        booker_id: String(r.booker_id),
        start_date: r.start_date,
        end_date: r.end_date,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    property_id: Number(state.property_id),
    booker_id: Number(state.booker_id),
    start_date: state.start_date,
    end_date: state.end_date,
  }
}

export function CalendarTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: bookings } = useSuspenseQuery(
    trpc.booking.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.booking.list.queryKey() })

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
      <h3>Calendar Test Form</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>{isEditing ? `Editing #${String(state.id)}` : "New booking"}</legend>

          <div>
            <label>
              Property id
              <input
                type="number"
                min={1}
                value={state.property_id}
                onChange={e => { set("property_id")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Booker id
              <input
                type="number"
                min={1}
                value={state.booker_id}
                onChange={e => { set("booker_id")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Start date
              <input
                type="date"
                value={state.start_date}
                onChange={e => { set("start_date")(e.target.value); }}
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
                min={state.start_date || undefined}
                onChange={e => { set("end_date")(e.target.value); }}
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

      <h4>Bookings</h4>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>property</th>
            <th>booker</th>
            <th>start</th>
            <th>end</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.property_id}</td>
              <td>
                {b.booker_id}
                {b.booker_name ? ` (${b.booker_name})` : ""}
              </td>
              <td>{b.start_date}</td>
              <td>{b.end_date}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    { dispatch({
                      type: "loadForEdit",
                      record: {
                        id: b.id,
                        property_id: b.property_id,
                        booker_id: b.booker_id,
                        start_date: b.start_date,
                        end_date: b.end_date,
                      },
                    }); }
                  }
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { deleteMutation.mutate({ id: b.id }); }}
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