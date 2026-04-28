import { type SyntheticEvent, useReducer } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

type Status = "draft" | "submitted" | "reimbursed" | "rejected"

type ExpenseType = "food" | "gas" | "maintenance" | "capex" | "opex" | "fixed"

type FormState = {
  description: string
  amount: string
  receipt_url: string
  date: string
  status: Status
  expense_types: ExpenseType[]
}

const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "gas", label: "Gas" },
  { value: "maintenance", label: "Maintenance" },
  { value: "capex", label: "Capex" },
  { value: "opex", label: "Opex" },
  { value: "fixed", label: "Fixed" },
]

const todayIso = () => new Date().toISOString().slice(0, 10)

const initialFormState: FormState = {
  description: "",
  amount: "0",
  receipt_url: "",
  date: todayIso(),
  status: "draft",
  expense_types: [],
}

type EditableStringField = Exclude<
  keyof FormState,
  "expense_types" | "status"
>

type FormAction =
  | { type: "setField"; field: EditableStringField; value: string }
  | { type: "toggleType"; value: ExpenseType }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value }
    case "toggleType": {
      const has = state.expense_types.includes(action.value)
      return {
        ...state,
        expense_types: has
          ? state.expense_types.filter(t => t !== action.value)
          : [...state.expense_types, action.value],
      }
    }
    case "reset":
      return { ...initialFormState, date: todayIso() }
  }
}

function buildPayload(state: FormState, status: Status) {
  return {
    description: state.description,
    amount: Number(state.amount),
    receipt_url: state.receipt_url ? state.receipt_url : null,
    date: state.date,
    status,
    expense_types: state.expense_types,
  }
}

export function ExpensesTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(formReducer, initialFormState)

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

  const pending = createMutation.isPending
  const lastError = createMutation.error

  const set = (field: EditableStringField) => (value: string) =>
    { dispatch({ type: "setField", field, value }); }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    createMutation.mutate(buildPayload(state, "submitted"))
  }

  return (
    <section>
      <h3>Expenses Test Form</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>New record</legend>

          <fieldset>
            <legend>Expense type</legend>
            {EXPENSE_TYPES.map(t => (
              <label key={t.value}>
                <input
                  type="checkbox"
                  checked={state.expense_types.includes(t.value)}
                  onChange={() => { dispatch({ type: "toggleType", value: t.value }); }}
                />
                {t.label}
              </label>
            ))}
          </fieldset>

          <div>
            <label>
              Amount
              <input
                type="number"
                step={1}
                value={state.amount}
                onChange={e => { set("amount")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <label>
              Receipt URL
              <input
                type="url"
                value={state.receipt_url}
                onChange={e => { set("receipt_url")(e.target.value); }}
                placeholder="https://..."
              />
            </label>
          </div>

          <div>
            <label>
              Description
              <input
                type="text"
                value={state.description}
                onChange={e => { set("description")(e.target.value); }}
              />
            </label>
          </div>

          <div>
            <label>
              Date
              <input
                type="date"
                value={state.date}
                onChange={e => { set("date")(e.target.value); }}
                required
              />
            </label>
          </div>

          <div>
            <button type="submit" disabled={pending}>
              Submit
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
    </section>
  )
}