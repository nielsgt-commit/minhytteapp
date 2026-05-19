import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"

type RoomRecord = {
  id: number
  name: string
  structure_id: number
  structure_name: string | null
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
}

type FormState = {
  id: number | null
  name: string
  structure_id: string
  beds_sm: string
  beds_lg: string
  beds_double: string
  beds_kid: string
  mattresses: string
  travel_cot: string
}

const initialFormState: FormState = {
  id: null,
  name: "",
  structure_id: "",
  beds_sm: "0",
  beds_lg: "0",
  beds_double: "0",
  beds_kid: "0",
  mattresses: "0",
  travel_cot: "0",
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
        structure_id: String(r.structure_id),
        beds_sm: String(r.beds_sm),
        beds_lg: String(r.beds_lg),
        beds_double: String(r.beds_double),
        beds_kid: String(r.beds_kid),
        mattresses: String(r.mattresses),
        travel_cot: String(r.travel_cot),
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    name: state.name,
    structure_id: Number(state.structure_id),
    beds_sm: Number(state.beds_sm),
    beds_lg: Number(state.beds_lg),
    beds_double: Number(state.beds_double),
    beds_kid: Number(state.beds_kid),
    mattresses: Number(state.mattresses),
    travel_cot: Number(state.travel_cot),
  }
}

export function RoomsTestForm() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())
  const { data: structures } = useSuspenseQuery(
    trpc.structure.list.queryOptions(),
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
      <h3>{t("Rooms Test Form")}</h3>

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
              {t("Structure")}
              <select
                value={state.structure_id}
                onChange={e => { set("structure_id")(e.target.value); }}
                required
              >
                <option value="">{t("(select structure)")}</option>
                {structures.map(b => (
                  <option key={b.id} value={b.id}>
                    #{b.id} {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>
              {t("Beds (single)")}
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
              {t("Beds (large)")}
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
              {t("Beds (double)")}
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
              {t("Beds (kid)")}
              <input
                type="number"
                min={0}
                value={state.beds_kid}
                onChange={e => { set("beds_kid")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              {t("Mattresses")}
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
              {t("Travel cot")}
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
            <th>{t("structure")}</th>
            <th>{t("beds_sm")}</th>
            <th>{t("beds_lg")}</th>
            <th>{t("beds_double")}</th>
            <th>{t("beds_kid")}</th>
            <th>{t("mattresses")}</th>
            <th>{t("travel_cot")}</th>
            <th>{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td>
                #{r.structure_id} {r.structure_name ?? ""}
              </td>
              <td>{r.beds_sm}</td>
              <td>{r.beds_lg}</td>
              <td>{r.beds_double}</td>
              <td>{r.beds_kid}</td>
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
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => { deleteMutation.mutate({ id: r.id }); }}
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
