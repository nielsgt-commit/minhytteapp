import { type SyntheticEvent, Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Field,
  Label,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./CreateSettlementFlow.module.css"
import { SplitPolicyBuilder } from "@/features/settlement/splitpolicybuilder/SplitPolicyBuilder.tsx"
import { useTRPC } from "@/trpc/trpc"

type Status = "open" | "closed"
type Season = "winter" | "spring" | "summer" | "autumn"

type EditTarget = {
  id: number
  status: Status
  season: Season | null
}

type Props = {
  propertyId: number
  year: string
  setYear: (v: string) => void
  splitPolicyId: string
  setSplitPolicyId: (v: string) => void
  editing: EditTarget | null
  pending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
  builderOpen: boolean
  onToggleBuilder: () => void
  onBuilderSaved: (policyId: number) => void
}

export function SettlementForm({
  propertyId,
  year,
  setYear,
  splitPolicyId,
  setSplitPolicyId,
  editing,
  pending,
  onSubmit,
  onCancel,
  builderOpen,
  onToggleBuilder,
  onBuilderSaved,
}: Props) {
  const trpc = useTRPC()
  const { data: customPolicies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  return (
    <form onSubmit={onSubmit}>
      <div className={styles.formRow}>
        <Textfield
          label="Year"
          type="number"
          value={year}
          onChange={e => { setYear(e.target.value) }}
          required
        />
        <Field>
          <Label>Split policy</Label>
          <Select
            value={splitPolicyId}
            onChange={e => { setSplitPolicyId(e.target.value) }}
          >
            <Select.Option value="">Occupancy days (built-in)</Select.Option>
            {customPolicies.map(p => (
              <Select.Option key={p.id} value={String(p.id)}>
                {p.name} (by {p.created_by_name ?? `#${String(p.created_by_id)}`})
              </Select.Option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={onToggleBuilder}
        >
          {builderOpen ? "Close split policy builder" : "Add split policy"}
        </Button>
        <Button type="submit" disabled={pending}>
          {editing == null
            ? "Create and start settlement"
            : `Update settlement #${String(editing.id)}`}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {builderOpen && (
        <Suspense fallback={<p>Loading split policy builder…</p>}>
          <SplitPolicyBuilder onSaved={onBuilderSaved} />
        </Suspense>
      )}
    </form>
  )
}
