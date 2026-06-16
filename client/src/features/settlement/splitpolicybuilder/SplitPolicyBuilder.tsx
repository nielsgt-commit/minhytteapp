import {
  Button,
  Card,
  Heading,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./SplitPolicyBuilder.module.css"
import { PolicySummary, type PolicyEdit } from "./PolicySummary"
import { SavedPolicies } from "./SavedPolicies"
import { WeightingHelp } from "./WeightingHelp"
import { useSplitPolicyContext } from "./SplitPolicyContext"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"

// Thin consumer of SplitPolicyContext: renders the policy form (parameters,
// rule sentences, name, save/reset) and the saved-policy list. The person-day
// counting panel lives on its own route (PersonDaysPanel) and shares the same
// context, so its references to the form stay intact.
export function SplitPolicyBuilder() {
  const { t } = useTranslation("settlement")
  const ctx = useSplitPolicyContext()
  const { form } = ctx

  const pending = ctx.pending
  const isEditing = form.id != null
  const nameMissing = form.name.trim().length === 0

  const edit: PolicyEdit = {
    allowed: ctx.allowed,
    pending,
    activeCategories: ctx.activeCategories,
    propertyUsers: ctx.propertyUsers,
    patchOccupancy: ctx.patchOccupancy,
    onAddRule: ctx.addRule,
    patchRule: ctx.patchRule,
    removeRule: ctx.removeRule,
    moveRule: ctx.moveRule,
    addWhoToRule: ctx.addWhoToRule,
    removeWhoFromRule: ctx.removeWhoFromRule,
    addExceptToRule: ctx.addExceptToRule,
    removeExceptFromRule: ctx.removeExceptFromRule,
    patchFallback: ctx.patchFallback,
    addWhoToFallback: ctx.addWhoToFallback,
    removeWhoFromFallback: ctx.removeWhoFromFallback,
    addExceptToFallback: ctx.addExceptToFallback,
    removeExceptFromFallback: ctx.removeExceptFromFallback,
  }

  return (
    <>
      <Card asChild>
        <section>
          <div className={styles.header}>
            <Heading level={4} data-size="2xs">
              {isEditing
                ? t("Editing policy #{{id}}", { id: String(form.id) })
                : t("New policy")}
            </Heading>
            <WeightingHelp />
          </div>

          <Paragraph data-size="sm">
            <strong>
              {t(
                "Costs related to operating and using {{property}} are split like this:",
                { property: ctx.propertyName },
              )}
            </strong>
          </Paragraph>

          <PolicySummary
            parameters={form.parameters}
            rules={form.rules}
            fallback={form.fallback}
            occupancy={form.occupancy}
            groups={ctx.groups}
            categories={ctx.categories}
            eligibleOwners={ctx.eligibleOwners}
            propertyName={ctx.propertyName}
            edit={edit}
          />

          <Textfield
            label={t("Name")}
            value={form.name}
            onChange={e => {
              ctx.setName(e.target.value)
            }}
            required
          />

          <div className={styles.actions}>
            <Button
              type="button"
              data-size="sm"
              disabled={pending || nameMissing}
              onClick={() => {
                void ctx.submitAction()
              }}
            >
              {isEditing ? t("Update policy") : t("Save policy")}
            </Button>
            {!isEditing && (
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                disabled={pending}
                onClick={() => {
                  ctx.loadPreset()
                }}
              >
                {t("Load occupancy_days preset")}
              </Button>
            )}
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={pending}
              onClick={() => {
                ctx.reset()
              }}
            >
              {t("Reset")}
            </Button>
          </div>

          <ErrorAlert error={ctx.error} />
        </section>
      </Card>

      <SavedPolicies
        policies={ctx.policies}
        me={ctx.me}
        groups={ctx.groups}
        categories={ctx.categories}
        eligibleOwners={ctx.eligibleOwners}
        propertyId={ctx.propertyId}
        propertyName={ctx.propertyName}
        pending={pending}
        onEdit={policy => {
          ctx.loadForEdit(policy)
        }}
        onDelete={(id, propId) => {
          ctx.deletePolicy(id, propId)
        }}
      />
    </>
  )
}
