import { type SyntheticEvent, useReducer } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  Button,
  Card,
  Field,
  Fieldset,
  Label,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./SettlementTestForm.module.css"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

type Season = "winter" | "spring" | "summer" | "autumn"
type Status = "open" | "closed"
type SplitPolicy = "shares" | "groups_equal" | "occupancy_days"

type SettlementRecord = {
  id: number
  year: number
  season: Season | null
  status: Status
  split_policy: SplitPolicy
  split_policy_id: number | null
}

type FormState = {
  id: number | null
  year: string
  status: Status
  split_policy: SplitPolicy
  split_policy_id: string
}

const STATUSES: Status[] = ["open", "closed"]
// Only occupancy_days is implemented in computePreviewSplit; add others as
// they become available.
const SPLIT_POLICIES: SplitPolicy[] = ["occupancy_days"]

const initialFormState: FormState = {
  id: null,
  year: String(new Date().getFullYear()),
  status: "open",
  split_policy: "occupancy_days",
  split_policy_id: "",
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
        status: r.status,
        split_policy: SPLIT_POLICIES.includes(r.split_policy)
          ? r.split_policy
          : SPLIT_POLICIES[0],
        split_policy_id:
          r.split_policy_id == null ? "" : String(r.split_policy_id),
      }
    }
    case "reset":
      return initialFormState
  }
}

function buildPayload(state: FormState, propertyId: number) {
  return {
    property_id: propertyId,
    year: Number(state.year),
    status: state.status,
    split_policy: state.split_policy,
    split_policy_id:
      state.split_policy_id === "" ? null : Number(state.split_policy_id),
  }
}

export function SettlementTestForm() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const [state, dispatch] = useReducer(formReducer, initialFormState)

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const { data: customPolicies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.settlement.pathKey() })

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
    if (selectedPropertyId == null) return
    const payload = buildPayload(state, selectedPropertyId)
    if (state.id == null) {
      createMutation.mutate(payload)
    } else {
      updateMutation.mutate({ id: state.id, ...payload })
    }
  }

  if (selectedPropertyId == null) {
    return (
      <section>
        <h3>Settlement Test Form</h3>
        <p>Select a property to manage settlements.</p>
      </section>
    )
  }

  return (
    <section>
      <h3>Settlement Test Form</h3>

      <form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>
            {isEditing ? `Editing #${String(state.id)}` : "New record"}
          </Fieldset.Legend>

          <div className={styles.formRow}>
            <Textfield
              label="Year"
              type="number"
              value={state.year}
              onChange={e => { set("year")(e.target.value); }}
              required
            />
            <Field>
              <Label>Status</Label>
              <Select
                value={state.status}
                onChange={e => { set("status")(e.target.value); }}
              >
                {STATUSES.map(s => (
                  <Select.Option key={s} value={s}>
                    {s}
                  </Select.Option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Split policy</Label>
              <Select
                value={state.split_policy}
                onChange={e => { set("split_policy")(e.target.value); }}
              >
                {SPLIT_POLICIES.map(p => (
                  <Select.Option key={p} value={p}>
                    {p}
                  </Select.Option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Custom policy</Label>
              <Select
                value={state.split_policy_id}
                onChange={e => { set("split_policy_id")(e.target.value); }}
              >
                <Select.Option value="">— none —</Select.Option>
                {customPolicies.map(p => (
                  <Select.Option key={p.id} value={String(p.id)}>
                    {p.name} (by {p.created_by_name ?? `#${String(p.created_by_id)}`})
                  </Select.Option>
                ))}
              </Select>
            </Field>
            <div className={styles.formActions}>
              <Button type="submit" disabled={pending}>
                {isEditing ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                onClick={() => { dispatch({ type: "reset" }); }}
                disabled={pending}
              >
                Reset
              </Button>
            </div>
          </div>
        </Fieldset>
      </form>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      <h4>Records</h4>
      <div className={styles.list}>
        {settlements.map(s => (
          <Card key={s.id} asChild>
            <article>
              <Card.Block data-size="sm">
                <div className={styles.row}>
                  <span className={styles.field}>
                    <span className={styles.fieldLabel}>id</span>
                    <span className={styles.fieldValue}>{s.id}</span>
                  </span>
                  <span className={styles.field}>
                    <span className={styles.fieldLabel}>year</span>
                    <span className={styles.fieldValue}>{s.year}</span>
                  </span>
                  <span className={styles.field}>
                    <span className={styles.fieldLabel}>season</span>
                    <span className={styles.fieldValue}>{s.season ?? ""}</span>
                  </span>
                  <span className={styles.field}>
                    <span className={styles.fieldLabel}>status</span>
                    <span className={styles.fieldValue}>{s.status}</span>
                  </span>
                  <span className={styles.field}>
                    <span className={styles.fieldLabel}>split_policy</span>
                    <span className={styles.fieldValue}>{s.split_policy}</span>
                  </span>
                  <span className={styles.field}>
                    <span className={styles.fieldLabel}>closed_at</span>
                    <span className={styles.fieldValue}>{s.closed_at ?? ""}</span>
                  </span>
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      onClick={() => {
                        dispatch({
                          type: "loadForEdit",
                          record: s as SettlementRecord,
                        })
                      }}
                      disabled={pending}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      onClick={() => { deleteMutation.mutate({ id: s.id }) }}
                      disabled={pending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card.Block>
            </article>
          </Card>
        ))}
      </div>
    </section>
  )
}