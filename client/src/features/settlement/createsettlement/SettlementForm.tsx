import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Field,
  Label,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./CreateSettlementFlow.module.css"
import { SplitPolicyBuilder } from "@/features/settlement/splitpolicybuilder/SplitPolicyBuilder.tsx"
import { PersonDaysPanel } from "@/features/settlement/splitpolicybuilder/PersonDaysPanel.tsx"
import { SplitPolicyProvider } from "@/features/settlement/splitpolicybuilder/SplitPolicyContext.tsx"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useTRPC } from "@/trpc/trpc"
import { Temporal } from "temporal-polyfill"

type Status = "open" | "closed"
type Season = "winter" | "spring" | "summer" | "autumn"

export type EditTarget = {
  id: number
  status: Status
  season: Season | null
  year: number
  splitPolicyId: number | null
}

type Props = {
  propertyId: number
  editing: EditTarget | null
  pending: boolean
  onSubmit: (values: { year: number; splitPolicyId: number | null }) => void
  onCancel: () => void
}

// The parent keys this form by the settlement being edited, so mount-time
// defaults are safe. The split-policy select stays controlled because saving
// a policy in the inline builder must select it.
export function SettlementForm({
  propertyId,
  editing,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  // "" is the unselected placeholder. There is no built-in policy to fall back
  // on anymore: a head must pick a saved policy or build one. A new settlement
  // starts blank; editing pre-selects the settlement's current saved policy
  // (legacy settlements with no policy stay blank, forcing a deliberate pick).
  const [splitPolicyId, setSplitPolicyId] = useState(
    editing?.splitPolicyId == null ? "" : String(editing.splitPolicyId),
  )
  const [builderOpen, setBuilderOpen] = useState(false)
  const { data: customPolicies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const handleSubmit = (fd: FormData) => {
    onSubmit({
      year: Number(fd.get("year")),
      splitPolicyId: splitPolicyId === "" ? null : Number(splitPolicyId),
    })
  }

  return (
    <form action={handleSubmit}>
      <div className={styles.formRow}>
        <Textfield
          label={t("Year")}
          name="year"
          type="number"
          defaultValue={editing?.year ?? Temporal.Now.plainDateISO().year}
          required
        />
        <Field>
          <Label>{t("Split policy")}</Label>
          <Select
            value={splitPolicyId}
            required
            onChange={e => {
              setSplitPolicyId(e.target.value)
            }}
          >
            <Select.Option value="">{t("Choose a split policy…")}</Select.Option>
            {customPolicies.map(p => (
              <Select.Option key={p.id} value={String(p.id)}>
                {t("{{name}} (by {{creator}})", {
                  name: p.name,
                  creator: p.created_by_name ?? `#${String(p.created_by_id)}`,
                })}
              </Select.Option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={() => {
            setBuilderOpen(v => !v)
          }}
        >
          {builderOpen
            ? t("Close split policy builder")
            : t("Add split policy")}
        </Button>
        <SubmitButton disabled={pending}>
          {editing == null
            ? t("Create and start settlement")
            : t("Update settlement #{{id}}", { id: String(editing.id) })}
        </SubmitButton>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          {t("Cancel")}
        </Button>
      </div>
      {builderOpen && (
        <QueryBoundary>
          <SplitPolicyProvider
            onSaved={id => {
              setSplitPolicyId(String(id))
              setBuilderOpen(false)
            }}
          >
            <PersonDaysPanel />
            <SplitPolicyBuilder />
          </SplitPolicyProvider>
        </QueryBoundary>
      )}
    </form>
  )
}
