import { type FormEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Status = "submitted" | "reimbursed" | "rejected"

type ExpenseRecord = {
  id: number
  description: string
  amount: number
  payer_id: number
  reimbursed_by_id: number | null
  booking_id: number | null
  maintenance_id: number | null
  settlement_id: number | null
  timestamp: string
  status: Status
}

type FormState = {
  id: number | null
  description: string
  amount: string
  payer_id: string
  reimbursed_by_id: string
  booking_id: string
  maintenance_id: string
  settlement_id: string
  timestamp: string
  status: Status
}

const STATUSES: Status[] = ["submitted", "reimbursed", "rejected"]

const initialFormState: FormState = {
  id: null,
  description: "",
  amount: "0",
  payer_id: "1",
  reimbursed_by_id: "",
  booking_id: "",
  maintenance_id: "",
  settlement_id: "",
  timestamp: "",
  status: "submitted",
}

type EditableField = Exclude<keyof FormState, "id">

type FormAction =
  | { type: "setField"; field: EditableField; value: string }
  | { type: "loadForEdit"; record: ExpenseRecord }
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
        amount: String(r.amount),
        payer_id: String(r.payer_id),
        reimbursed_by_id:
          r.reimbursed_by_id != null ? String(r.reimbursed_by_id) : "",
        booking_id: r.booking_id != null ? String(r.booking_id) : "",
        maintenance_id:
          r.maintenance_id != null ? String(r.maintenance_id) : "",
        settlement_id:
          r.settlement_id != null ? String(r.settlement_id) : "",
        timestamp: r.timestamp,
        status: r.status,
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState) {
  return {
    description: state.description,
    amount: Number(state.amount),
    payer_id: Number(state.payer_id),
    reimbursed_by_id: state.reimbursed_by_id
      ? Number(state.reimbursed_by_id)
      : undefined,
    booking_id: state.booking_id ? Number(state.booking_id) : undefined,
    maintenance_id: state.maintenance_id
      ? Number(state.maintenance_id)
      : undefined,
    settlement_id: state.settlement_id
      ? Number(state.settlement_id)
      : undefined,
    timestamp: state.timestamp,
    status: state.status,
  }
}

export function ExpensesTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: expenses } = useSuspenseQuery(
    trpc.expense.list.queryOptions(),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.expense.list.queryKey() })

  const createMutation = useMutation(
    trpc.expense.create.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.expense.update.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "reset" })
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.expense.delete.mutationOptions({
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

  const reimbursedRequired = state.status === "reimbursed"

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
      <h3>Expenses Test Form</h3>

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
              Amount
              <input
                type="number"
                step={1}
                value={state.amount}
                onChange={e => set("amount")(e.target.value)}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Payer (user id)
              <input
                type="number"
                min={1}
                value={state.payer_id}
                onChange={e => set("payer_id")(e.target.value)}
                required
              />
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
              Reimbursed by (user id)
              {reimbursedRequired ? " (required)" : ""}
              <input
                type="number"
                min={1}
                value={state.reimbursed_by_id}
                onChange={e => set("reimbursed_by_id")(e.target.value)}
                required={reimbursedRequired}
              />
            </label>
          </div>

          <div>
            <label>
              Booking id
              <input
                type="number"
                min={1}
                value={state.booking_id}
                onChange={e => set("booking_id")(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label>
              Maintenance id
              <input
                type="number"
                min={1}
                value={state.maintenance_id}
                onChange={e => set("maintenance_id")(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label>
              Settlement id
              <input
                type="number"
                min={1}
                value={state.settlement_id}
                onChange={e => set("settlement_id")(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label>
              Timestamp
              <input
                type="text"
                value={state.timestamp}
                onChange={e => set("timestamp")(e.target.value)}
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
            <th>description</th>
            <th>amount</th>
            <th>payer</th>
            <th>reimbursed_by</th>
            <th>status</th>
            <th>timestamp</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(e => (
            <tr key={e.id}>
              <td>{e.id}</td>
              <td>{e.description}</td>
              <td>{e.amount}</td>
              <td>{e.payer_id}</td>
              <td>{e.reimbursed_by_id ?? ""}</td>
              <td>{e.status}</td>
              <td>{e.timestamp}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "loadForEdit",
                      record: e as ExpenseRecord,
                    })
                  }
                  disabled={pending}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({ id: e.id })}
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