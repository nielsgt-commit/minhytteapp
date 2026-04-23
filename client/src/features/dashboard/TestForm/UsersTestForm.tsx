import { type FormEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type UserRecord = {
  id: number
  name: string
  date_of_birth: number
  email: string
}

type FormState = {
  id: number | null
  name: string
  date_of_birth: string
  email: string
}

const initialFormState: FormState = {
  id: null,
  name: "",
  date_of_birth: "",
  email: "",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
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
        date_of_birth: String(r.date_of_birth),
        email: r.email,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    name: state.name,
    date_of_birth: Number(state.date_of_birth),
    email: state.email,
  }
}

export function UsersTestForm() {
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
      <h3>Users Test Form</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>{isEditing ? `Editing #${state.id}` : "New record"}</legend>

          <div>
            <label>
              Name
              <input
                type="text"
                value={state.name}
                onChange={e => set("name")(e.target.value)}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Date of birth (year)
              <input
                type="number"
                value={state.date_of_birth}
                onChange={e => set("date_of_birth")(e.target.value)}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Email
              <input
                type="email"
                value={state.email}
                onChange={e => set("email")(e.target.value)}
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
            <th>name</th>
            <th>date_of_birth</th>
            <th>email</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.date_of_birth}</td>
              <td>{u.email}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "loadForEdit",
                      record: u as UserRecord,
                    })
                  }
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({ id: u.id })}
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
