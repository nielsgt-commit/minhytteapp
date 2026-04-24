import { useReducer, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

type Category = "maintenance" | "repair"
type Severity = "major" | "minor" | "patch"
type Status = "todo" | "doing" | "done"
type Recurrence = "once" | "yearly" | "5year"

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
}

type FormState = {
  id: number | null
  description: string
  summary: string
  assigned_to_id: string
  building_id: string
  category: Category
  severity: Severity
  status: Status
  recurrence: Recurrence
}

const CATEGORIES: Category[] = ["maintenance", "repair"]
const SEVERITIES: Severity[] = ["major", "minor", "patch"]
const STATUSES: Status[] = ["todo", "doing", "done"]
const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "once", label: "once" },
  { value: "yearly", label: "yearly" },
  { value: "5year", label: "5 year" },
]

const initialFormState: FormState = {
  id: null,
  description: "",
  summary: "",
  assigned_to_id: "",
  building_id: "",
  category: "maintenance",
  severity: "minor",
  status: "todo",
  recurrence: "once",
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
        assigned_to_id:
          r.assigned_to_id != null ? String(r.assigned_to_id) : "",
        building_id: r.building_id != null ? String(r.building_id) : "",
        category: r.category,
        severity: r.severity,
        status: r.status,
        recurrence: r.recurrence,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState, addedBy: number) {
  return {
    description: state.description,
    summary: state.summary.trim() ? state.summary : undefined,
    added_by: addedBy,
    assigned_to_id: state.assigned_to_id
      ? Number(state.assigned_to_id)
      : undefined,
    building_id: state.building_id ? Number(state.building_id) : undefined,
    category: state.category,
    severity: state.severity,
    status: state.status,
    recurrence: state.recurrence,
  }
}

export function MaintenanceTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedUserId = useAppSelector(selectSelectedUserId)
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const [state, dispatch] = useReducer(formReducer, initialFormState)
  const [showMore, setShowMore] = useState(false)

  const { data: tasks } = useSuspenseQuery(
    trpc.maintenance.list.queryOptions(),
  )
  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: buildings } = useSuspenseQuery(
    trpc.building.list.queryOptions(),
  )

  const propertyBuildings =
    selectedPropertyId != null
      ? buildings.filter(b => b.property_id === selectedPropertyId)
      : []
  const propertyBuildingIds = new Set(propertyBuildings.map(b => b.id))
  const propertyTasks = tasks.filter(
    t => t.building_id != null && propertyBuildingIds.has(t.building_id),
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

  const set = (field: EditableField) => (value: string) => {
    dispatch({ type: "setField", field, value })
  }

  const canSubmit =
    selectedUserId != null &&
    selectedPropertyId != null &&
    state.building_id !== ""

  return (
    <section>
      <h3>Maintenance Test Form</h3>

      {selectedUserId == null && (
        <p role="alert">No user selected — pick one from the header.</p>
      )}
      {selectedPropertyId == null && (
        <p role="alert">No property selected — pick one from the header.</p>
      )}

      <form
        onSubmit={e => {
          e.preventDefault()
          if (selectedUserId == null) return
          const payload = buildPayload(state, selectedUserId)
          if (state.id == null) {
            createMutation.mutate(payload)
          } else {
            updateMutation.mutate({ id: state.id, ...payload })
          }
        }}
      >
        <fieldset>
          <legend>
            {isEditing ? `Editing #${String(state.id)}` : "New record"}
          </legend>

          <div>
            <label>
              Description
              <input
                type="text"
                value={state.description}
                onChange={e => {
                  set("description")(e.target.value)
                }}
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
                onChange={e => {
                  set("summary")(e.target.value)
                }}
              />
            </label>
          </div>

          <div>
            <label>
              Status
              <select
                value={state.status}
                onChange={e => {
                  set("status")(e.target.value)
                }}
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
            <button
              type="button"
              onClick={() => {
                setShowMore(v => !v)
              }}
              aria-expanded={showMore}
            >
              {showMore ? "Hide details" : "Add more details"}
            </button>
          </div>

          {showMore && (
            <>
              <div>
                <label>
                  Assigned to
                  <select
                    value={state.assigned_to_id}
                    onChange={e => {
                      set("assigned_to_id")(e.target.value)
                    }}
                  >
                    <option value="">(unassigned)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        #{u.id} {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label>
                  Location
                  <select
                    value={state.building_id}
                    onChange={e => {
                      set("building_id")(e.target.value)
                    }}
                    required
                  >
                    <option value="">(select building)</option>
                    {propertyBuildings.map(b => (
                      <option key={b.id} value={b.id}>
                        #{b.id} {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label>
                  Category
                  <select
                    value={state.category}
                    onChange={e => {
                      set("category")(e.target.value)
                    }}
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
                    onChange={e => {
                      set("severity")(e.target.value)
                    }}
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
                  Recurrence
                  <select
                    value={state.recurrence}
                    onChange={e => {
                      set("recurrence")(e.target.value)
                    }}
                  >
                    {RECURRENCES.map(r => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
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
            <th>building</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {propertyTasks.map(t => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.description}</td>
              <td>{t.status}</td>
              <td>{t.severity}</td>
              <td>{t.category}</td>
              <td>{t.recurrence}</td>
              <td>
                {t.building_id != null
                  ? `b#${String(t.building_id)}`
                  : t.place_id != null
                    ? `p#${String(t.place_id)}`
                    : ""}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "loadForEdit",
                      record: t as MaintenanceRecord,
                    })
                  }}
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteMutation.mutate({ id: t.id })
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