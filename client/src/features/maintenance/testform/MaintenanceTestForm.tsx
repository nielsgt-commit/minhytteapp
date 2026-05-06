import { useReducer, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

type Category = "maintenance" | "repair"
type Severity = "major" | "minor" | "patch"
type Status = "todo" | "doing" | "done"
type Recurrence = "once" | "yearly" | "5year"

type FormState = {
  id: number | null
  description: string
  summary: string
  assigned_to_id: string
  building_id: string
  place_id: string
  category: Category
  severity: Severity
  status: Status
  recurrence: Recurrence
  when: string
}

const CATEGORIES: Category[] = ["maintenance", "repair"]
const SEVERITIES: Severity[] = ["major", "minor", "patch"]
const STATUSES: Status[] = ["todo", "doing", "done"]
const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "once", label: "once" },
  { value: "yearly", label: "yearly" },
  { value: "5year", label: "5 year" },
]

function defaultPriorityYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 8
    ? now.getUTCFullYear() + 1
    : now.getUTCFullYear()
}

const initialFormState: FormState = {
  id: null,
  description: "",
  summary: "",
  assigned_to_id: "",
  building_id: "",
  place_id: "",
  category: "maintenance",
  severity: "minor",
  status: "todo",
  recurrence: "once",
  when: "",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "setLocation"; kind: "building" | "place" | "none"; id: string }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "setLocation":
      if (action.kind === "building") {
        return { ...state, building_id: action.id, place_id: "" }
      }
      if (action.kind === "place") {
        return { ...state, building_id: "", place_id: action.id }
      }
      return { ...state, building_id: "", place_id: "" }
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
    place_id: state.place_id ? Number(state.place_id) : undefined,
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

  const { data: users = [] } = useQuery(
    trpc.user.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: buildings = [] } = useQuery(
    trpc.building.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: places = [] } = useQuery(
    trpc.place.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const priorityYear = defaultPriorityYear()
  const { data: priority } = useQuery(
    trpc.priority.list.queryOptions(
      { property_id: selectedPropertyId ?? 0, year: priorityYear },
      { enabled: selectedPropertyId != null },
    ),
  )

  const priorityWhenOptions = (() => {
    if (!priority) return []
    const ownerName = new Map(
      priority.eligibleOwners.map(o => [o.property_owner_id, o.user_name]),
    )
    return priority.assignments
      .filter(a => a.iso_week === 28 || a.iso_week === 29 || a.iso_week === 30)
      .map(a => ({
        value: `week:${String(a.iso_week)}`,
        label: `${ownerName.get(a.property_owner_id) ?? `#${String(a.property_owner_id)}`} uke`,
      }))
  })()

  const propertyBuildings = buildings

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.maintenance.pathKey() })

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

  const isEditing = state.id != null
  const pending = createMutation.isPending || updateMutation.isPending
  const lastError = createMutation.error ?? updateMutation.error

  const set = (field: EditableField) => (value: string) => {
    dispatch({ type: "setField", field, value })
  }

  const canSubmit =
    selectedUserId != null &&
    selectedPropertyId != null &&
    (state.building_id !== "" || state.place_id !== "")

  const locationValue =
    state.building_id !== ""
      ? `b:${state.building_id}`
      : state.place_id !== ""
        ? `p:${state.place_id}`
        : ""

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
            <label>
              When
              <select
                value={state.when}
                onChange={e => {
                  set("when")(e.target.value)
                }}
              >
                <option value="">(select)</option>
                {priorityWhenOptions.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="dugnad">dugnad</option>
                <option value="just_in_time">just in time</option>
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
                    value={locationValue}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === "") {
                        dispatch({ type: "setLocation", kind: "none", id: "" })
                        return
                      }
                      const [prefix, id] = raw.split(":")
                      if (prefix === "b") {
                        dispatch({ type: "setLocation", kind: "building", id })
                      } else if (prefix === "p") {
                        dispatch({ type: "setLocation", kind: "place", id })
                      }
                    }}
                    required
                  >
                    <option value="">(select location)</option>
                    {propertyBuildings.length > 0 && (
                      <optgroup label="Buildings">
                        {propertyBuildings.map(b => (
                          <option key={`b-${String(b.id)}`} value={`b:${String(b.id)}`}>
                            #{b.id} {b.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {places.length > 0 && (
                      <optgroup label="Places">
                        {places.map(p => (
                          <option key={`p-${String(p.id)}`} value={`p:${String(p.id)}`}>
                            #{p.id} {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
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
    </section>
  )
}