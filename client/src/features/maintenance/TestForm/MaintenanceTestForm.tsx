import { type FormEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Category =
  | "plumbing"
  | "electrical"
  | "grounds"
  | "exterior"
  | "interior"
  | "other"
type Severity = "major" | "minor" | "patch"
type Status = "todo" | "doing" | "done"
type Recurrence = "ephemeral" | "recurring"
type LocationType = "building" | "place"

type MaintenanceRecord = {
  id: number
  description: string
  summary: string | null
  added_by: number
  assigned_to_id: number | null
  building_id: number | null
  place_id: number | null
  category: Category
  severity: Severity
  status: Status
  recurrence: Recurrence
  recurrence_interval_days: number | null
}

type FormState = {
  id: number | null
  description: string
  summary: string
  added_by: string
  assigned_to_id: string
  locationType: LocationType
  building_id: string
  place_id: string
  category: Category
  severity: Severity
  status: Status
  recurrence: Recurrence
  recurrence_interval_days: string
}

const CATEGORIES: Category[] = [
  "plumbing",
  "electrical",
  "grounds",
  "exterior",
  "interior",
  "other",
]
const SEVERITIES: Severity[] = ["major", "minor", "patch"]
const STATUSES: Status[] = ["todo", "doing", "done"]
const RECURRENCES: Recurrence[] = ["ephemeral", "recurring"]

const initialFormState: FormState = {
  id: null,
  description: "",
  summary: "",
  added_by: "1",
  assigned_to_id: "",
  locationType: "building",
  building_id: "1",
  place_id: "",
  category: "other",
  severity: "minor",
  status: "todo",
  recurrence: "ephemeral",
  recurrence_interval_days: "",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "loadForEdit"; record: MaintenanceRecord }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "loadForEdit": {
      const r = action.record
      return {
        id: r.id,
        description: r.description,
        summary: r.summary ?? "",
        added_by: String(r.added_by),
        assigned_to_id:
          r.assigned_to_id != null ? String(r.assigned_to_id) : "",
        locationType: r.building_id != null ? "building" : "place",
        building_id: r.building_id != null ? String(r.building_id) : "",
        place_id: r.place_id != null ? String(r.place_id) : "",
        category: r.category,
        severity: r.severity,
        status: r.status,
        recurrence: r.recurrence,
        recurrence_interval_days:
          r.recurrence_interval_days != null
            ? String(r.recurrence_interval_days)
            : "",
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    description: state.description,
    summary: state.summary.trim() ? state.summary : undefined,
    added_by: Number(state.added_by),
    assigned_to_id: state.assigned_to_id
      ? Number(state.assigned_to_id)
      : undefined,
    building_id:
      state.locationType === "building" && state.building_id
        ? Number(state.building_id)
        : undefined,
    place_id:
      state.locationType === "place" && state.place_id
        ? Number(state.place_id)
        : undefined,
    category: state.category,
    severity: state.severity,
    status: state.status,
    recurrence: state.recurrence,
    recurrence_interval_days:
      state.recurrence === "recurring" && state.recurrence_interval_days
        ? Number(state.recurrence_interval_days)
        : undefined,
  }
}

export function MaintenanceTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: tasks } = useSuspenseQuery(
    trpc.maintenance.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.maintenance.list.queryKey() })

  const createMutation = useMutation(
    trpc.maintenance.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.maintenance.delete.mutationOptions({
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
    dispatch({ type: "setField", field, value })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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
      <h3>Maintenance Test Form</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>{isEditing ? `Editing #${state.id}` : "New record"}</legend>

          <div>
            <label>
              Description
              <input
                type="text"
                value={state.description}
                onChange={e => set("description")(e.target.value)}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Summary
              <input
                type="text"
                value={state.summary}
                onChange={e => set("summary")(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label>
              Added by (user id)
              <input
                type="number"
                min={1}
                value={state.added_by}
                onChange={e => set("added_by")(e.target.value)}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Assigned to (user id)
              <input
                type="number"
                min={1}
                value={state.assigned_to_id}
                onChange={e => set("assigned_to_id")(e.target.value)}
              />
            </label>
          </div>

          <div>
            <fieldset>
              <legend>Location</legend>
              <label>
                <input
                  type="radio"
                  name="locationType"
                  value="building"
                  checked={state.locationType === "building"}
                  onChange={() => set("locationType")("building")}
                />
                Building
              </label>
              <label>
                <input
                  type="radio"
                  name="locationType"
                  value="place"
                  checked={state.locationType === "place"}
                  onChange={() => set("locationType")("place")}
                />
                Place
              </label>
              {state.locationType === "building" ? (
                <label>
                  Building id
                  <input
                    type="number"
                    min={1}
                    value={state.building_id}
                    onChange={e => set("building_id")(e.target.value)}
                    required
                  />
                </label>
              ) : (
                <label>
                  Place id
                  <input
                    type="number"
                    min={1}
                    value={state.place_id}
                    onChange={e => set("place_id")(e.target.value)}
                    required
                  />
                </label>
              )}
            </fieldset>
          </div>

          <div>
            <label>
              Category
              <select
                value={state.category}
                onChange={e => set("category")(e.target.value)}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>
              Severity
              <select
                value={state.severity}
                onChange={e => set("severity")(e.target.value)}
              >
                {SEVERITIES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>
              Status
              <select
                value={state.status}
                onChange={e => set("status")(e.target.value)}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>
              Recurrence
              <select
                value={state.recurrence}
                onChange={e => set("recurrence")(e.target.value)}
              >
                {RECURRENCES.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.recurrence === "recurring" && (
            <div>
              <label>
                Recurrence interval (days)
                <input
                  type="number"
                  min={1}
                  value={state.recurrence_interval_days}
                  onChange={e =>
                    set("recurrence_interval_days")(e.target.value)
                  }
                  required
                />
              </label>
            </div>
          )}

          <div>
            <button type="submit" disabled={pending}>
              {isEditing ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "reset" })}
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
            <th>description</th>
            <th>status</th>
            <th>severity</th>
            <th>category</th>
            <th>recurrence</th>
            <th>building/place</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.description}</td>
              <td>{t.status}</td>
              <td>{t.severity}</td>
              <td>{t.category}</td>
              <td>
                {t.recurrence}
                {t.recurrence_interval_days
                  ? ` (${t.recurrence_interval_days}d)`
                  : ""}
              </td>
              <td>
                {t.building_id != null
                  ? `b#${t.building_id}`
                  : `p#${t.place_id}`}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "loadForEdit",
                      record: t as MaintenanceRecord,
                    })
                  }
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({ id: t.id })}
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