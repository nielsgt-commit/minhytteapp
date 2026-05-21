import { useSelectedUserId, useSelectedPropertyId } from "@/app/useSelectedIds"
import { useReducer, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Field,
  Label,
  Select,
  Textarea,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"

type Category = "maintenance" | "repair"
type Severity = "major" | "minor" | "patch"
type Status = "todo" | "doing" | "done"
type Recurrence = "once" | "yearly" | "5year"

type FormState = {
  id: number | null
  description: string
  instructions: string
  assigned_to_id: string
  structure_id: string
  infrastructure_id: string
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
  instructions: "",
  assigned_to_id: "",
  structure_id: "",
  infrastructure_id: "",
  category: "maintenance",
  severity: "patch",
  status: "todo",
  recurrence: "once",
  when: "",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "setLocation"; kind: "structure" | "infrastructure" | "none"; id: string }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "setLocation":
      if (action.kind === "structure") {
        return { ...state, structure_id: action.id, infrastructure_id: "" }
      }
      if (action.kind === "infrastructure") {
        return { ...state, structure_id: "", infrastructure_id: action.id }
      }
      return { ...state, structure_id: "", infrastructure_id: "" }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState, addedBy: number) {
  return {
    description: state.description,
    instructions: state.instructions.trim() ? state.instructions : undefined,
    added_by: addedBy,
    assigned_to_id: state.assigned_to_id
      ? Number(state.assigned_to_id)
      : undefined,
    structure_id: state.structure_id ? Number(state.structure_id) : undefined,
    infrastructure_id: state.infrastructure_id ? Number(state.infrastructure_id) : undefined,
    category: state.category,
    severity: state.severity,
    status: state.status,
    recurrence: state.recurrence,
  }
}

export function MaintenanceTestForm() {
  const { t } = useTranslation("maintenance")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedUserId = useSelectedUserId()
  const selectedPropertyId = useSelectedPropertyId()
  const [state, dispatch] = useReducer(formReducer, initialFormState)
  const [showMore, setShowMore] = useState(false)

  const { data: users = [] } = useQuery(
    trpc.user.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: structures = [] } = useQuery(
    trpc.structure.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: infrastructure = [] } = useQuery(
    trpc.infrastructure.listForProperty.queryOptions(
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

  const propertyStructures = structures

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
    (state.structure_id !== "" || state.infrastructure_id !== "")

  const locationValue =
    state.structure_id !== ""
      ? `b:${state.structure_id}`
      : state.infrastructure_id !== ""
        ? `p:${state.infrastructure_id}`
        : ""

  return (
    <section>
      <h3>{t("Maintenance Test Form")}</h3>

      {selectedUserId == null && (
        <p role="alert">{t("No user selected — pick one from the header.")}</p>
      )}
      {selectedPropertyId == null && (
        <p role="alert">{t("No property selected — pick one from the header.")}</p>
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
            {isEditing ? t("Editing #{{id}}", { id: String(state.id) }) : t("New record")}
          </legend>

          <Textfield
            label={t("Description")}
            value={state.description}
            onChange={e => {
              set("description")(e.target.value)
            }}
            required
          />

          <Field>
            <Label>{t("Instructions")}</Label>
            <Textarea
              value={state.instructions}
              onChange={e => {
                set("instructions")(e.target.value)
              }}
              rows={4}
            />
          </Field>

          <Field>
            <Label>{t("Status")}</Label>
            <Select
              value={state.status}
              onChange={e => {
                set("status")(e.target.value)
              }}
            >
              {STATUSES.map(s => (
                <Select.Option key={s} value={s}>
                  {s}
                </Select.Option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label>{t("When")}</Label>
            <Select
              value={state.when}
              onChange={e => {
                set("when")(e.target.value)
              }}
            >
              <Select.Option value="">{t("(select)")}</Select.Option>
              {priorityWhenOptions.map(o => (
                <Select.Option key={o.value} value={o.value}>
                  {o.label}
                </Select.Option>
              ))}
              <Select.Option value="dugnad">{t("dugnad")}</Select.Option>
              <Select.Option value="just_in_time">{t("just in time")}</Select.Option>
            </Select>
          </Field>

          <div>
            <Button
              variant="tertiary"
              onClick={() => {
                setShowMore(v => !v)
              }}
              aria-expanded={showMore}
            >
              {showMore ? t("Hide details") : t("Add more details")}
            </Button>
          </div>

          {showMore && (
            <>
              <Field>
                <Label>{t("Assigned to")}</Label>
                <Select
                  value={state.assigned_to_id}
                  onChange={e => {
                    set("assigned_to_id")(e.target.value)
                  }}
                >
                  <Select.Option value="">{t("(unassigned)")}</Select.Option>
                  {users.map(u => (
                    <Select.Option key={u.id} value={u.id}>
                      #{u.id} {u.name}
                    </Select.Option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>{t("Location")}</Label>
                <Select
                  value={locationValue}
                  onChange={e => {
                    const raw = e.target.value
                    if (raw === "") {
                      dispatch({ type: "setLocation", kind: "none", id: "" })
                      return
                    }
                    const [prefix, id] = raw.split(":")
                    if (prefix === "b") {
                      dispatch({ type: "setLocation", kind: "structure", id })
                    } else if (prefix === "p") {
                      dispatch({ type: "setLocation", kind: "infrastructure", id })
                    }
                  }}
                  required
                >
                  <Select.Option value="">{t("(select location)")}</Select.Option>
                  {propertyStructures.length > 0 && (
                    <Select.Optgroup label={t("Structures")}>
                      {propertyStructures.map(b => (
                        <Select.Option key={`b-${String(b.id)}`} value={`b:${String(b.id)}`}>
                          #{b.id} {b.name}
                        </Select.Option>
                      ))}
                    </Select.Optgroup>
                  )}
                  {infrastructure.length > 0 && (
                    <Select.Optgroup label={t("Infrastructure")}>
                      {infrastructure.map(p => (
                        <Select.Option key={`p-${String(p.id)}`} value={`p:${String(p.id)}`}>
                          #{p.id} {p.name}
                        </Select.Option>
                      ))}
                    </Select.Optgroup>
                  )}
                </Select>
              </Field>

              <Field>
                <Label>{t("Category")}</Label>
                <Select
                  value={state.category}
                  onChange={e => {
                    set("category")(e.target.value)
                  }}
                >
                  {CATEGORIES.map(c => (
                    <Select.Option key={c} value={c}>
                      {c}
                    </Select.Option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>{t("Severity")}</Label>
                <Select
                  value={state.severity}
                  onChange={e => {
                    set("severity")(e.target.value)
                  }}
                >
                  {SEVERITIES.map(s => (
                    <Select.Option key={s} value={s}>
                      {s}
                    </Select.Option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>{t("Recurrence")}</Label>
                <Select
                  value={state.recurrence}
                  onChange={e => {
                    set("recurrence")(e.target.value)
                  }}
                >
                  {RECURRENCES.map(r => (
                    <Select.Option key={r.value} value={r.value}>
                      {r.label}
                    </Select.Option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          <div>
            <Button type="submit" disabled={pending || !canSubmit}>
              {isEditing ? t("Update") : t("Create")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: "reset" })
              }}
              disabled={pending}
            >
              {t("Reset")}
            </Button>
          </div>
        </fieldset>
      </form>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}
    </section>
  )
}