import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"

type PropertyRecord = {
  id: number
  name: string
  address: string
}

type FormState = {
  id: number | null
  name: string
  address: string
}

const initialFormState: FormState = {
  id: null,
  name: "",
  address: "",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "loadForEdit"; record: PropertyRecord }
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
        address: r.address,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    name: state.name,
    address: state.address,
  }
}

export function PropertyTestForm() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })

  const createMutation = useMutation(
    trpc.property.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.property.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.property.delete.mutationOptions({
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
      <h3>{t("Property Test Form")}</h3>

      <form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>{isEditing ? t("Editing #{{id}}", { id: state.id ?? 0 }) : t("New record")}</Fieldset.Legend>

          <div>
            <Textfield
              label={t("Name")}
              type="text"
              value={state.name}
              onChange={e => { set("name")(e.target.value); }}
              required
            />
          </div>

          <div>
            <Textfield
              label={t("Address")}
              type="text"
              value={state.address}
              onChange={e => { set("address")(e.target.value); }}
              required
            />
          </div>

          <div>
            <Button type="submit" disabled={pending}>
              {isEditing ? t("Update") : t("Create")}
            </Button>
            <Button
              type="button"
              onClick={() => { dispatch({ type: "reset" }); }}
              disabled={pending}
            >
              {t("Reset")}
            </Button>
          </div>
        </Fieldset>
      </form>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      <h4>{t("Records")}</h4>
      <table>
        <thead>
          <tr>
            <th>{t("id")}</th>
            <th>{t("name")}</th>
            <th>{t("address")}</th>
            <th>{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {properties.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.address}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    { dispatch({
                      type: "loadForEdit",
                      record: p as PropertyRecord,
                    }); }
                  }
                  disabled={pending}
                >
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => { deleteMutation.mutate({ id: p.id }); }}
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
