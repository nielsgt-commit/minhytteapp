import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"

type UserRecord = {
  id: number
  name: string
  email: string
  is_child: boolean | null
}

type FormState = {
  id: number | null
  name: string
  email: string
  is_child: boolean
}

const initialFormState: FormState = {
  id: null,
  name: "",
  email: "",
  is_child: false,
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string | boolean }
  | { type: "loadForEdit"; record: UserRecord }
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
        email: r.email,
        is_child: r.is_child ?? false,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    name: state.name,
    email: state.email,
    is_child: state.is_child,
  }
}

export function UsersTestForm() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })

  const createMutation = useMutation(
    trpc.user.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.user.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.user.delete.mutationOptions({
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
      <h3>{t("Users Test Form")}</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>{isEditing ? t("Editing #{{id}}", { id: state.id ?? 0 }) : t("New record")}</legend>

          <div>
            <label>
              {t("Name")}
              <input
                type="text"
                value={state.name}
                onChange={e => {
                  dispatch({ type: "setField", field: "name", value: e.target.value })
                }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              {t("Email")}
              <input
                type="email"
                value={state.email}
                onChange={e => {
                  dispatch({ type: "setField", field: "email", value: e.target.value })
                }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={state.is_child}
                onChange={e => {
                  dispatch({ type: "setField", field: "is_child", value: e.target.checked })
                }}
              />
              {t("Is child")}
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
            <th>{t("email")}</th>
            <th>{t("is_child")}</th>
            <th>{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.is_child ? t("yes") : t("no")}</td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "loadForEdit",
                      record: u as UserRecord,
                    })
                  }}
                  disabled={pending}
                >
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => { deleteMutation.mutate({ id: u.id }); }}
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