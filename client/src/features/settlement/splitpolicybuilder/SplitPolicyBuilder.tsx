import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Fieldset,
  Heading,
  Paragraph,
  Select,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { ExceptPicker } from "./ExceptPicker"
import { RuleEditor } from "./RuleEditor"
import { SavedPolicies } from "./SavedPolicies"
import { WhoPicker } from "./WhoPicker"
import { useSplitPolicyForm } from "./useSplitPolicyForm"
import {
  type EligibleOwner,
  type How,
  HOW_LABEL,
  WHEN_LABEL,
  allUsersInProperty,
  decodeWhen,
  describeExcept,
  describeWho,
  encodeExcept,
  encodeWhen,
  encodeWho,
} from "./types"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { Temporal } from "temporal-polyfill"

type SplitPolicyBuilderProps = {
  onSaved?: (policyId: number) => void
}

export function SplitPolicyBuilder({ onSaved }: SplitPolicyBuilderProps = {}) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const {
    form,
    setName,
    patchRule,
    patchFallback,
    addRule,
    removeRule,
    moveRule,
    addExceptToRule,
    removeExceptFromRule,
    addExceptToFallback,
    removeExceptFromFallback,
    addWhoToRule,
    removeWhoFromRule,
    addWhoToFallback,
    removeWhoFromFallback,
    loadPreset,
    loadForEdit,
    reset,
  } = useSplitPolicyForm()

  const { data: policies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.listAllForDisplay.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const activeCategories = categories.filter(c => c.archived_at == null)
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: priorityData } = useSuspenseQuery(
    trpc.priority.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
      year: Temporal.Now.plainDateISO().year,
    }),
  )
  const eligibleOwners: EligibleOwner[] = priorityData.eligibleOwners

  const saveMutation = useMutationWithInvalidation(
    trpc.propertySplitPolicy.save.mutationOptions({
      onSuccess: saved => {
        reset()
        onSaved?.(saved.id)
      },
    }),
    [trpc.propertySplitPolicy.pathKey()],
  )

  const deleteMutation = useMutationWithInvalidation(
    trpc.propertySplitPolicy.delete.mutationOptions(),
    [trpc.propertySplitPolicy.pathKey()],
  )

  const status = useMutationsStatus(saveMutation, deleteMutation)

  if (selectedPropertyId == null) {
    return (
      <Card asChild>
        <section>
          <Paragraph>
            {t("Select a property to design custom split policies.")}
          </Paragraph>
        </section>
      </Card>
    )
  }

  const propertyId = selectedPropertyId
  const pending = status.pending
  const isEditing = form.id != null
  const propertyUsers = allUsersInProperty(groups)

  const submitAction = async () => {
    const trimmedName = form.name.trim()
    if (trimmedName.length === 0) return
    await saveMutation
      .mutateAsync({
        id: form.id ?? undefined,
        property_id: propertyId,
        name: trimmedName,
        config: { rules: form.rules, fallback: form.fallback },
      })
      .catch(() => undefined)
  }

  const fallbackSelectedEncoded = new Set(
    form.fallback.except.map(encodeExcept),
  )

  return (
    <Card asChild>
      <section>
        <Paragraph data-size="sm">
          <Trans
            ns="settlement"
            i18nKey="Build a policy as an ordered list of rules. Each expense is matched by the first rule whose <em>what</em> filter accepts it; anything unmatched falls through to the default rule at the bottom."
            components={{ em: <em /> }}
          />
        </Paragraph>

        <form action={submitAction}>
          <Fieldset>
            <Fieldset.Legend>
              {isEditing
                ? t("Editing policy #{{id}}", { id: String(form.id) })
                : t("New policy")}
            </Fieldset.Legend>

            <Textfield
              label={t("Name")}
              value={form.name}
              onChange={e => {
                setName(e.target.value)
              }}
              required
            />

            <Heading level={4} data-size="2xs">
              {t("Rules")}
            </Heading>
            {form.rules.length === 0 ? (
              <Paragraph data-size="sm">
                {t(
                  "No specific rules — the default rule below applies to everything.",
                )}
              </Paragraph>
            ) : (
              form.rules.map((rule, idx) => (
                <RuleEditor
                  key={idx}
                  rule={rule}
                  idx={idx}
                  isLast={idx === form.rules.length - 1}
                  pending={pending}
                  activeCategories={activeCategories}
                  groups={groups}
                  propertyUsers={propertyUsers}
                  eligibleOwners={eligibleOwners}
                  onPatch={patchRule}
                  onMove={moveRule}
                  onRemove={removeRule}
                  onAddWho={addWhoToRule}
                  onRemoveWho={removeWhoFromRule}
                  onAddExcept={addExceptToRule}
                  onRemoveExcept={removeExceptFromRule}
                />
              ))
            )}

            <Button
              type="button"
              variant="secondary"
              data-size="sm"
              onClick={() => {
                addRule()
              }}
              disabled={pending}
            >
              {t("+ Add rule")}
            </Button>

            <Card asChild>
              <div>
                <Card.Block data-size="sm">
                  <Heading level={5} data-size="2xs">
                    {t("Default (applies to the rest)")}
                  </Heading>
                  <Paragraph data-size="sm">
                    {t("Split the rest")}{" "}
                    <Select
                      data-size="sm"
                      value={form.fallback.how.kind}
                      onChange={e => {
                        patchFallback({
                          how: { kind: e.target.value as How["kind"] },
                        })
                      }}
                    >
                      {Object.entries(HOW_LABEL).map(([value, label]) => (
                        <Select.Option key={value} value={value}>
                          {(t as (k: string) => string)(label)}
                        </Select.Option>
                      ))}
                    </Select>{" "}
                    {t("between")}{" "}
                    {form.fallback.who.length === 0 ? (
                      <em>{t("nobody selected")}</em>
                    ) : (
                      form.fallback.who.map(w => {
                        const enc = encodeWho(w)
                        return (
                          <Button
                            key={enc}
                            type="button"
                            variant="tertiary"
                            data-size="sm"
                            onClick={() => {
                              removeWhoFromFallback(enc)
                            }}
                          >
                            {describeWho(w, groups)} ✕
                          </Button>
                        )
                      })
                    )}{" "}
                    {t("who were")}{" "}
                    <Select
                      data-size="sm"
                      value={encodeWhen(form.fallback.when)}
                      onChange={e => {
                        patchFallback({ when: decodeWhen(e.target.value) })
                      }}
                    >
                      {Object.entries(WHEN_LABEL).map(([value, label]) => (
                        <Select.Option key={value} value={value}>
                          {(t as (k: string) => string)(label)}
                        </Select.Option>
                      ))}
                      {eligibleOwners.length > 0 && (
                        <Select.Optgroup label={t("Specific priority week")}>
                          {eligibleOwners.map(o => {
                            const enc = `during_priority_week:${String(o.user_group_id)}`
                            return (
                              <Select.Option key={enc} value={enc}>
                                {t("{{name}}'s priority week", {
                                  name: o.user_group_name,
                                })}
                              </Select.Option>
                            )
                          })}
                        </Select.Optgroup>
                      )}
                    </Select>
                  </Paragraph>
                  <Switch
                    label={t(
                      "Include extra guest names (attributed to booker's group)",
                    )}
                    data-size="sm"
                    checked={form.fallback.include_extra_guests}
                    onChange={e => {
                      patchFallback({ include_extra_guests: e.target.checked })
                    }}
                  />
                  <WhoPicker
                    propertyUsers={propertyUsers}
                    groups={groups}
                    selectedEncoded={new Set(form.fallback.who.map(encodeWho))}
                    onAdd={enc => {
                      addWhoToFallback(enc)
                    }}
                  />
                </Card.Block>
                <Card.Block data-size="sm">
                  <Paragraph data-size="sm">
                    <strong>{t("except:")}</strong>{" "}
                    {form.fallback.except.length === 0 ? (
                      <em>{t("nobody")}</em>
                    ) : (
                      form.fallback.except.map(e => {
                        const enc = encodeExcept(e)
                        return (
                          <Button
                            key={enc}
                            type="button"
                            variant="tertiary"
                            data-size="sm"
                            onClick={() => {
                              removeExceptFromFallback(enc)
                            }}
                          >
                            {describeExcept(e, groups)} ✕
                          </Button>
                        )
                      })
                    )}
                  </Paragraph>
                  <ExceptPicker
                    propertyUsers={propertyUsers}
                    groups={groups}
                    selectedEncoded={fallbackSelectedEncoded}
                    onAdd={enc => {
                      addExceptToFallback(enc)
                    }}
                  />
                </Card.Block>
              </div>
            </Card>

            <div>
              <SubmitButton disabled={pending}>
                {isEditing ? t("Update policy") : t("Save policy")}
              </SubmitButton>
              <Button
                type="button"
                variant="tertiary"
                onClick={() => {
                  reset()
                }}
                disabled={pending}
              >
                {t("Reset")}
              </Button>
              {!isEditing && (
                <Button
                  type="button"
                  variant="tertiary"
                  data-size="sm"
                  onClick={() => {
                    loadPreset()
                  }}
                  disabled={pending}
                >
                  {t("Load occupancy_days preset")}
                </Button>
              )}
            </div>
          </Fieldset>
        </form>

        <ErrorAlert error={status.error} />

        <SavedPolicies
          policies={policies}
          me={me}
          groups={groups}
          categories={categories}
          eligibleOwners={eligibleOwners}
          propertyId={propertyId}
          pending={pending}
          onEdit={loadForEdit}
          onDelete={(id, propId) => {
            deleteMutation.mutate({ id, property_id: propId })
          }}
        />
      </section>
    </Card>
  )
}
