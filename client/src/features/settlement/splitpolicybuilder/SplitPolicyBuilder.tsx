import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
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
import { ExceptPicker } from "./ExceptPicker"
import { RuleEditor } from "./RuleEditor"
import { SavedPolicies, type SavedPolicy } from "./SavedPolicies"
import { WhoPicker } from "./WhoPicker"
import {
  type EligibleOwner,
  type Fallback,
  type FormState,
  type How,
  HOW_LABEL,
  INITIAL_FORM,
  NEW_RULE,
  OCCUPANCY_DAYS_PRESET,
  type Rule,
  WHEN_LABEL,
  allUsersInProperty,
  decodeExcept,
  decodeWhen,
  decodeWho,
  describeExcept,
  describeWho,
  encodeExcept,
  encodeWhen,
  encodeWho,
  normalizeWho,
} from "./types"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

type SplitPolicyBuilderProps = {
  onSaved?: (policyId: number) => void
}

export function SplitPolicyBuilder({ onSaved }: SplitPolicyBuilderProps = {}) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

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
    trpc.expenseCategory.listAllForDisplay.queryOptions(),
  )
  const activeCategories = categories.filter(c => c.archived_at == null)
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: priorityData } = useSuspenseQuery(
    trpc.priority.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
      year: new Date().getFullYear(),
    }),
  )
  const eligibleOwners: EligibleOwner[] = priorityData.eligibleOwners

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: trpc.propertySplitPolicy.pathKey() })

  const saveMutation = useMutation(
    trpc.propertySplitPolicy.save.mutationOptions({
      onSuccess: saved => {
        setForm(INITIAL_FORM)
        void invalidate()
        onSaved?.(saved.id)
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.propertySplitPolicy.delete.mutationOptions({
      onSuccess: () => {
        void invalidate()
      },
    }),
  )

  if (selectedPropertyId == null) {
    return (
      <Card asChild>
        <section>
          <Heading level={3} data-size="xs">Split policy builder</Heading>
          <Paragraph>Select a property to design custom split policies.</Paragraph>
        </section>
      </Card>
    )
  }

  const propertyId = selectedPropertyId
  const pending = saveMutation.isPending || deleteMutation.isPending
  const isEditing = form.id != null
  const propertyUsers = allUsersInProperty(groups)

  const setName = (name: string) => { setForm(f => ({ ...f, name })) }

  const patchRule = (idx: number, patch: Partial<Rule>) => {
    setForm(f => ({
      ...f,
      rules: f.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
  }

  const patchFallback = (patch: Partial<Fallback>) => {
    setForm(f => ({ ...f, fallback: { ...f.fallback, ...patch } }))
  }

  const addRule = () => {
    setForm(f => ({ ...f, rules: [...f.rules, NEW_RULE] }))
  }

  const removeRule = (idx: number) => {
    setForm(f => ({
      ...f,
      rules: f.rules.filter((_, i) => i !== idx),
    }))
  }

  const moveRule = (idx: number, delta: -1 | 1) => {
    setForm(f => {
      const target = idx + delta
      if (target < 0 || target >= f.rules.length) return f
      const next = [...f.rules]
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      return { ...f, rules: next }
    })
  }

  const addExceptToRule = (idx: number, encoded: string) => {
    if (encoded === "") return
    const item = decodeExcept(encoded)
    if (item == null) return
    setForm(f => {
      const rule = f.rules[idx]
      const already = rule.except.some(
        e => encodeExcept(e) === encoded,
      )
      if (already) return f
      return {
        ...f,
        rules: f.rules.map((r, i) =>
          i === idx ? { ...r, except: [...r.except, item] } : r,
        ),
      }
    })
  }

  const removeExceptFromRule = (idx: number, encoded: string) => {
    setForm(f => ({
      ...f,
      rules: f.rules.map((r, i) =>
        i === idx
          ? { ...r, except: r.except.filter(e => encodeExcept(e) !== encoded) }
          : r,
      ),
    }))
  }

  const addExceptToFallback = (encoded: string) => {
    if (encoded === "") return
    const item = decodeExcept(encoded)
    if (item == null) return
    setForm(f => {
      const already = f.fallback.except.some(
        e => encodeExcept(e) === encoded,
      )
      if (already) return f
      return {
        ...f,
        fallback: {
          ...f.fallback,
          except: [...f.fallback.except, item],
        },
      }
    })
  }

  const removeExceptFromFallback = (encoded: string) => {
    setForm(f => ({
      ...f,
      fallback: {
        ...f.fallback,
        except: f.fallback.except.filter(e => encodeExcept(e) !== encoded),
      },
    }))
  }

  const addWhoToRule = (idx: number, encoded: string) => {
    if (encoded === "") return
    const item = decodeWho(encoded)
    setForm(f => {
      const rule = f.rules[idx]
      if (rule.who.some(w => encodeWho(w) === encoded)) return f
      return {
        ...f,
        rules: f.rules.map((r, i) =>
          i === idx ? { ...r, who: [...r.who, item] } : r,
        ),
      }
    })
  }

  const removeWhoFromRule = (idx: number, encoded: string) => {
    setForm(f => ({
      ...f,
      rules: f.rules.map((r, i) =>
        i === idx ? { ...r, who: r.who.filter(w => encodeWho(w) !== encoded) } : r,
      ),
    }))
  }

  const addWhoToFallback = (encoded: string) => {
    if (encoded === "") return
    const item = decodeWho(encoded)
    setForm(f => {
      if (f.fallback.who.some(w => encodeWho(w) === encoded)) return f
      return { ...f, fallback: { ...f.fallback, who: [...f.fallback.who, item] } }
    })
  }

  const removeWhoFromFallback = (encoded: string) => {
    setForm(f => ({
      ...f,
      fallback: {
        ...f.fallback,
        who: f.fallback.who.filter(w => encodeWho(w) !== encoded),
      },
    }))
  }

  const loadPreset = () => {
    setForm(f => ({ ...f, ...OCCUPANCY_DAYS_PRESET }))
  }

  const loadForEdit = (policy: SavedPolicy) => {
    setForm({
      id: policy.id,
      name: policy.name,
      rules: policy.config.rules.map(r => ({
        ...r,
        who: normalizeWho(r.who),
        include_extra_guests: r.include_extra_guests ?? false,
      })),
      fallback: {
        ...policy.config.fallback,
        who: normalizeWho(policy.config.fallback.who),
        include_extra_guests: policy.config.fallback.include_extra_guests ?? false,
      },
    })
  }

  const reset = () => { setForm(INITIAL_FORM) }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length === 0) return
    saveMutation.mutate({
      id: form.id ?? undefined,
      property_id: propertyId,
      name: trimmedName,
      config: { rules: form.rules, fallback: form.fallback },
    })
  }

  const fallbackSelectedEncoded = new Set(
    form.fallback.except.map(encodeExcept),
  )

  return (
    <Card asChild>
      <section>
      <Heading level={3} data-size="xs">Split policy builder</Heading>
      <Paragraph data-size="sm">
        Build a policy as an ordered list of rules. Each expense is matched
        by the first rule whose <em>what</em> filter accepts it; anything
        unmatched falls through to the default rule at the bottom.
      </Paragraph>

      <form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>
            {isEditing ? `Editing policy #${String(form.id)}` : "New policy"}
          </Fieldset.Legend>

          <Textfield
            label="Name"
            value={form.name}
            onChange={e => { setName(e.target.value) }}
            required
          />

          <Heading level={4} data-size="2xs">Rules</Heading>
          {form.rules.length === 0 ? (
            <Paragraph data-size="sm">
              No specific rules — the default rule below applies to everything.
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
            onClick={() => { addRule() }}
            disabled={pending}
          >
            + Add rule
          </Button>

          <Card asChild>
            <article>
              <Card.Block data-size="sm">
                <Heading level={5} data-size="2xs">Default (applies to the rest)</Heading>
                <Paragraph data-size="sm">
                  Split the rest{" "}
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
                        {label}
                      </Select.Option>
                    ))}
                  </Select>{" "}
                  between{" "}
                  {form.fallback.who.length === 0 ? (
                    <em>nobody selected</em>
                  ) : (
                    form.fallback.who.map(w => {
                      const enc = encodeWho(w)
                      return (
                        <Button
                          key={enc}
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          onClick={() => { removeWhoFromFallback(enc) }}
                        >
                          {describeWho(w, groups)} ✕
                        </Button>
                      )
                    })
                  )}{" "}
                  who were{" "}
                  <Select
                    data-size="sm"
                    value={encodeWhen(form.fallback.when)}
                    onChange={e => {
                      patchFallback({ when: decodeWhen(e.target.value) })
                    }}
                  >
                    {Object.entries(WHEN_LABEL).map(([value, label]) => (
                      <Select.Option key={value} value={value}>
                        {label}
                      </Select.Option>
                    ))}
                    {eligibleOwners.length > 0 && (
                      <Select.Optgroup label="Specific priority week">
                        {eligibleOwners.map(o => {
                          const enc = `during_priority_week:${String(o.property_owner_id)}`
                          return (
                            <Select.Option key={enc} value={enc}>
                              {o.user_name}&apos;s priority week
                            </Select.Option>
                          )
                        })}
                      </Select.Optgroup>
                    )}
                  </Select>
                </Paragraph>
                <Switch
                  label="Include extra guest names (attributed to booker's group)"
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
                  onAdd={enc => { addWhoToFallback(enc) }}
                />
              </Card.Block>
              <Card.Block data-size="sm">
                <Paragraph data-size="sm">
                  <strong>except:</strong>{" "}
                  {form.fallback.except.length === 0 ? (
                    <em>nobody</em>
                  ) : (
                    form.fallback.except.map(e => {
                      const enc = encodeExcept(e)
                      return (
                        <Button
                          key={enc}
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          onClick={() => { removeExceptFromFallback(enc) }}
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
                  onAdd={enc => { addExceptToFallback(enc) }}
                />
              </Card.Block>
            </article>
          </Card>

          <div>
            <Button type="submit" disabled={pending}>
              {isEditing ? "Update policy" : "Save policy"}
            </Button>
            <Button
              type="button"
              variant="tertiary"
              onClick={() => { reset() }}
              disabled={pending}
            >
              Reset
            </Button>
            {!isEditing && (
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                onClick={() => { loadPreset() }}
                disabled={pending}
              >
                Load occupancy_days preset
              </Button>
            )}
          </div>
        </Fieldset>
      </form>

      {saveMutation.error && (
        <p role="alert">Error: {saveMutation.error.message}</p>
      )}
      {deleteMutation.error && (
        <p role="alert">Error: {deleteMutation.error.message}</p>
      )}

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
