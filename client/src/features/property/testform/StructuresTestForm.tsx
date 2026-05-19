import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"

type StructureRecord = {
  id: number
  name: string
  property_id: number
  property_name: string | null
}

type FormState = {
  id: number | null
  name: string
  property_id: string
}

const initialFormState: FormState = {
  id: null,
  name: "",
  property_id: "",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "loadForEdit"; record: StructureRecord }
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
        property_id: String(r.property_id),
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    name: state.name,
    property_id: Number(state.property_id),
  }
}

export function StructuresTestForm() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: structures } = useSuspenseQuery(
    trpc.structure.list.queryOptions(),
  )
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.structure.list.queryKey() })

  const createMutation = useMutation(
    trpc.structure.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.structure.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.structure.delete.mutationOptions({
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
      <h3>{t("Structures Test Form")}</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>{isEditing ? t("Editing #{{id}}", { id: state.id ?? 0 }) : t("New record")}</legend>

          <div>
            <label>
              {t("Name")}
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
              {t("Property")}
              <select
                value={state.property_id}
                onChange={e => { set("property_id")(e.target.value); }}
                required
              >
                <option value="">{t("(select property)")}</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <button type="submit" disabled={pending}>
              {isEditing ? t("Update") : t("Create")}
            </button>
            <button
              type="button"
              onClick={() => { dispatch({ type: "reset" }); }}
              disabled={pending}
            >
              {t("Reset")}
            </button>
          </div>
        </fieldset>
      </form>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      <h4>{t("Records")}</h4>
      <table>
        <thead>
          <tr>
            <th>{t("id")}</th>
            <th>{t("name")}</th>
            <th>{t("property_id")}</th>
            <th>{t("property_name")}</th>
            <th>{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {structures.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.name}</td>
              <td>{b.property_id}</td>
              <td>{b.property_name ?? ""}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    { dispatch({
                      type: "loadForEdit",
                      record: b as StructureRecord,
                    }); }
                  }
                  disabled={pending}
                >
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => { deleteMutation.mutate({ id: b.id }); }}
                  disabled={pending}
                >
                  {t("Delete")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}