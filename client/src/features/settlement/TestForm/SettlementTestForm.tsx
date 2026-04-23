import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Season = "winter" | "spring" | "summer" | "autumn"
type Status = "open" | "closed"
type SplitPolicy = "shares" | "families_equal" | "occupancy_days"

type SettlementRecord = {
  id: number
  year: number
  season: Season | null
  status: Status
  split_policy: SplitPolicy
}

type FormState = {
  id: number | null
  year: string
  season: "" | Season
  status: Status
  split_policy: SplitPolicy
}

const SEASONS: Season[] = ["winter", "spring", "summer", "autumn"]
const STATUSES: Status[] = ["open", "closed"]
const SPLIT_POLICIES: SplitPolicy[] = [
  "shares",
  "families_equal",
  "occupancy_days",
]

const initialFormState: FormState = {
  id: null,
  year: String(new Date().getFullYear()),
  season: "",
  status: "open",
  split_policy: "shares",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "loadForEdit"; record: SettlementRecord }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "loadForEdit": {
      const r = action.record
      return {
        id: r.id,
        year: String(r.year),
        season: r.season ?? "",
        status: r.status,
        split_policy: r.split_policy,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    year: Number(state.year),
    season: state.season === "" ? undefined : state.season,
    status: state.status,
    split_policy: state.split_policy,
  }
}

export function SettlementTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.settlement.list.queryKey() })

  const createMutation = useMutation(
    trpc.settlement.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.settlement.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.settlement.delete.mutationOptions({
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
      <h3>Settlement Test Form</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>{isEditing ? `Editing #${String(state.id)}` : "New record"}</legend>

          <div>
            <label>
              Year
              <input
                type="number"
                value={state.year}
                onChange={e => { set("year")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Season
              <select
                value={state.season}
                onChange={e => { set("season")(e.target.value); }}
              >
                <option value="">(none)</option>
                {SEASONS.map(s => (
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
                onChange={e => { set("status")(e.target.value); }}
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
              Split policy
              <select
                value={state.split_policy}
                onChange={e => { set("split_policy")(e.target.value); }}
              >
                {SPLIT_POLICIES.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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

      <h4>Records</h4>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>year</th>
            <th>season</th>
            <th>status</th>
            <th>split_policy</th>
            <th>closed_at</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {settlements.map(s => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.year}</td>
              <td>{s.season ?? ""}</td>
              <td>{s.status}</td>
              <td>{s.split_policy}</td>
              <td>{s.closed_at ?? ""}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    { dispatch({
                      type: "loadForEdit",
                      record: s as SettlementRecord,
                    }); }
                  }
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { deleteMutation.mutate({ id: s.id }); }}
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