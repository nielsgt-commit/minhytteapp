import { type SyntheticEvent, useState } from "react"
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
  Heading,
  Label,
  Paragraph,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

type What =
  | { kind: "total" }
  | { kind: "category"; category_id: number }

type How =
  | { kind: "equally" }
  | { kind: "weighted_by_occupancy" }

type Who =
  | { kind: "all_users" }
  | { kind: "user_group"; group_id: number }
  | { kind: "heads_only" }

type When =
  | { kind: "always" }
  | { kind: "present_when_expense_added" }
  | { kind: "present_this_year" }
  | { kind: "during_any_priority_week" }

type ExceptItem =
  | { kind: "user"; user_id: number }
  | { kind: "group"; group_id: number }

type Rule = {
  what: What
  how: How
  who: Who
  except: ExceptItem[]
  when: When
}

type Fallback = Omit<Rule, "what">

type FormState = {
  id: number | null
  name: string
  rules: Rule[]
  fallback: Fallback
}

const DEFAULT_FALLBACK: Fallback = {
  how: { kind: "equally" },
  who: { kind: "all_users" },
  except: [],
  when: { kind: "always" },
}

const NEW_RULE: Rule = {
  what: { kind: "total" },
  how: { kind: "equally" },
  who: { kind: "all_users" },
  except: [],
  when: { kind: "always" },
}

const INITIAL_FORM: FormState = {
  id: null,
  name: "",
  rules: [],
  fallback: DEFAULT_FALLBACK,
}

const HOW_LABEL: Record<How["kind"], string> = {
  equally: "equally",
  weighted_by_occupancy: "weighted by occupancy",
}

const WHEN_LABEL: Record<When["kind"], string> = {
  always: "anytime",
  present_when_expense_added: "present when expense was added",
  present_this_year: "present this year",
  during_any_priority_week: "during any priority week",
}

function encodeWhat(w: What): string {
  return w.kind === "total" ? "total" : `category:${String(w.category_id)}`
}

function decodeWhat(v: string): What {
  if (v === "total") return { kind: "total" }
  const id = Number(v.slice("category:".length))
  return { kind: "category", category_id: id }
}

function encodeWho(w: Who): string {
  switch (w.kind) {
    case "all_users":
      return "all_users"
    case "heads_only":
      return "heads_only"
    case "user_group":
      return `user_group:${String(w.group_id)}`
  }
}

function decodeWho(v: string): Who {
  if (v === "all_users") return { kind: "all_users" }
  if (v === "heads_only") return { kind: "heads_only" }
  const id = Number(v.slice("user_group:".length))
  return { kind: "user_group", group_id: id }
}

function encodeExcept(item: ExceptItem): string {
  return item.kind === "user"
    ? `user:${String(item.user_id)}`
    : `group:${String(item.group_id)}`
}

function decodeExcept(v: string): ExceptItem | null {
  if (v.startsWith("user:")) {
    return { kind: "user", user_id: Number(v.slice("user:".length)) }
  }
  if (v.startsWith("group:")) {
    return { kind: "group", group_id: Number(v.slice("group:".length)) }
  }
  return null
}

type GroupWithMembers = {
  id: number
  name: string
  is_main: boolean
  members: { user_id: number; user_name: string }[]
}

type Category = { id: number; name: string }

function nameForGroup(groups: GroupWithMembers[], id: number) {
  return groups.find(g => g.id === id)?.name ?? `group #${String(id)}`
}

function nameForUser(groups: GroupWithMembers[], id: number) {
  for (const g of groups) {
    const m = g.members.find(mm => mm.user_id === id)
    if (m) return m.user_name
  }
  return `user #${String(id)}`
}

function nameForCategory(categories: Category[], id: number) {
  return categories.find(c => c.id === id)?.name ?? `category #${String(id)}`
}

function describeWhat(w: What, categories: Category[]) {
  return w.kind === "total" ? "total" : nameForCategory(categories, w.category_id)
}

function describeWho(w: Who, groups: GroupWithMembers[]) {
  switch (w.kind) {
    case "all_users":
      return "all users"
    case "heads_only":
      return "heads of this property"
    case "user_group":
      return `group "${nameForGroup(groups, w.group_id)}"`
  }
}

function describeExcept(
  item: ExceptItem,
  groups: GroupWithMembers[],
) {
  return item.kind === "user"
    ? nameForUser(groups, item.user_id)
    : `group "${nameForGroup(groups, item.group_id)}"`
}

function allUsersInProperty(groups: GroupWithMembers[]) {
  const map = new Map<number, string>()
  for (const g of groups) {
    for (const m of g.members) {
      if (!map.has(m.user_id)) map.set(m.user_id, m.user_name)
    }
  }
  return [...map.entries()]
    .map(([user_id, user_name]) => ({ user_id, user_name }))
    .sort((a, b) => a.user_name.localeCompare(b.user_name))
}

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
    trpc.expenseCategory.list.queryOptions(),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())

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
      <section>
        <Heading level={3} data-size="xs">Split policy builder</Heading>
        <Paragraph>Select a property to design custom split policies.</Paragraph>
      </section>
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

  const loadForEdit = (policy: (typeof policies)[number]) => {
    setForm({
      id: policy.id,
      name: policy.name,
      rules: policy.config.rules,
      fallback: policy.config.fallback,
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

  const renderExceptPicker = (
    selectedEncoded: Set<string>,
    onAdd: (encoded: string) => void,
  ) => (
    <Field>
      <Label data-size="sm">Add exclude</Label>
      <Select
        value=""
        onChange={e => {
          onAdd(e.target.value)
          e.target.value = ""
        }}
      >
        <Select.Option value="">— pick someone to exclude —</Select.Option>
        <Select.Optgroup label="Users">
          {propertyUsers.map(u => {
            const enc = `user:${String(u.user_id)}`
            return (
              <Select.Option
                key={enc}
                value={enc}
                disabled={selectedEncoded.has(enc)}
              >
                {u.user_name}
              </Select.Option>
            )
          })}
        </Select.Optgroup>
        <Select.Optgroup label="Groups">
          {groups.map(g => {
            const enc = `group:${String(g.id)}`
            return (
              <Select.Option
                key={enc}
                value={enc}
                disabled={selectedEncoded.has(enc)}
              >
                {g.name}
              </Select.Option>
            )
          })}
        </Select.Optgroup>
      </Select>
    </Field>
  )

  const renderRuleEditor = (rule: Rule, idx: number) => {
    const selectedEncoded = new Set(rule.except.map(encodeExcept))
    return (
      <Card key={idx} asChild>
        <article>
          <Card.Block data-size="sm">
            <Heading level={5} data-size="2xs">
              Rule #{idx + 1}
            </Heading>
            <Paragraph data-size="sm">
              Split{" "}
              <Select
                data-size="sm"
                value={encodeWhat(rule.what)}
                onChange={e => {
                  patchRule(idx, { what: decodeWhat(e.target.value) })
                }}
              >
                <Select.Option value="total">total</Select.Option>
                {categories.map(c => (
                  <Select.Option
                    key={c.id}
                    value={`category:${String(c.id)}`}
                  >
                    category: {c.name}
                  </Select.Option>
                ))}
              </Select>{" "}
              <Select
                data-size="sm"
                value={rule.how.kind}
                onChange={e => {
                  patchRule(idx, {
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
              <Select
                data-size="sm"
                value={encodeWho(rule.who)}
                onChange={e => {
                  patchRule(idx, { who: decodeWho(e.target.value) })
                }}
              >
                <Select.Option value="all_users">all users</Select.Option>
                <Select.Option value="heads_only">heads of this property</Select.Option>
                <Select.Optgroup label="By group">
                  {groups.map(g => (
                    <Select.Option
                      key={g.id}
                      value={`user_group:${String(g.id)}`}
                    >
                      group: {g.name}
                    </Select.Option>
                  ))}
                </Select.Optgroup>
              </Select>{" "}
              who were{" "}
              <Select
                data-size="sm"
                value={rule.when.kind}
                onChange={e => {
                  patchRule(idx, {
                    when: { kind: e.target.value as When["kind"] },
                  })
                }}
              >
                {Object.entries(WHEN_LABEL).map(([value, label]) => (
                  <Select.Option key={value} value={value}>
                    {label}
                  </Select.Option>
                ))}
              </Select>
            </Paragraph>
          </Card.Block>

          <Card.Block data-size="sm">
            <Paragraph data-size="sm">
              <strong>except:</strong>{" "}
              {rule.except.length === 0 ? (
                <em>nobody</em>
              ) : (
                rule.except.map(e => {
                  const enc = encodeExcept(e)
                  return (
                    <Button
                      key={enc}
                      type="button"
                      variant="tertiary"
                      data-size="sm"
                      onClick={() => { removeExceptFromRule(idx, enc) }}
                    >
                      {describeExcept(e, groups)} ✕
                    </Button>
                  )
                })
              )}
            </Paragraph>
            {renderExceptPicker(selectedEncoded, enc => {
              addExceptToRule(idx, enc)
            })}
          </Card.Block>

          <Card.Block data-size="sm">
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={idx === 0 || pending}
              onClick={() => { moveRule(idx, -1) }}
            >
              ↑ Up
            </Button>
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={idx === form.rules.length - 1 || pending}
              onClick={() => { moveRule(idx, 1) }}
            >
              ↓ Down
            </Button>
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={pending}
              onClick={() => { removeRule(idx) }}
            >
              Remove rule
            </Button>
          </Card.Block>
        </article>
      </Card>
    )
  }

  const fallbackSelectedEncoded = new Set(
    form.fallback.except.map(encodeExcept),
  )

  return (
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
            form.rules.map((rule, idx) => renderRuleEditor(rule, idx))
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
                  <Select
                    data-size="sm"
                    value={encodeWho(form.fallback.who)}
                    onChange={e => {
                      patchFallback({ who: decodeWho(e.target.value) })
                    }}
                  >
                    <Select.Option value="all_users">all users</Select.Option>
                    <Select.Option value="heads_only">heads of this property</Select.Option>
                    <Select.Optgroup label="By group">
                      {groups.map(g => (
                        <Select.Option
                          key={g.id}
                          value={`user_group:${String(g.id)}`}
                        >
                          group: {g.name}
                        </Select.Option>
                      ))}
                    </Select.Optgroup>
                  </Select>{" "}
                  who were{" "}
                  <Select
                    data-size="sm"
                    value={form.fallback.when.kind}
                    onChange={e => {
                      patchFallback({
                        when: { kind: e.target.value as When["kind"] },
                      })
                    }}
                  >
                    {Object.entries(WHEN_LABEL).map(([value, label]) => (
                      <Select.Option key={value} value={value}>
                        {label}
                      </Select.Option>
                    ))}
                  </Select>
                </Paragraph>
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
                {renderExceptPicker(fallbackSelectedEncoded, enc => {
                  addExceptToFallback(enc)
                })}
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
          </div>
        </Fieldset>
      </form>

      {saveMutation.error && (
        <p role="alert">Error: {saveMutation.error.message}</p>
      )}
      {deleteMutation.error && (
        <p role="alert">Error: {deleteMutation.error.message}</p>
      )}

      <Heading level={4} data-size="2xs">Saved policies</Heading>
      <Paragraph data-size="sm">
        <em>Live preview not yet implemented — the settlement engine still
        evaluates the built-in <code>occupancy_days</code> policy. These
        saved rules are persisted but not yet consumed by{" "}
        <code>computePreviewSplit</code>.</em>
      </Paragraph>
      {policies.length === 0 ? (
        <Paragraph data-size="sm">No custom policies yet.</Paragraph>
      ) : (
        policies.map(policy => {
          const canEdit = me != null
            && (policy.created_by_id === me.id || me.is_admin)
          return (
          <Card key={policy.id} asChild>
            <article>
              <Card.Block data-size="sm">
                <Heading level={5} data-size="2xs">{policy.name}</Heading>
                <Paragraph data-size="sm">
                  by{" "}
                  <strong>
                    {policy.created_by_name ?? `user #${String(policy.created_by_id)}`}
                  </strong>
                </Paragraph>
                <ol>
                  {policy.config.rules.map((rule, i) => (
                    <li key={`${String(policy.id)}-${String(i)}`}>
                      Split <strong>{describeWhat(rule.what, categories)}</strong>{" "}
                      <strong>{HOW_LABEL[rule.how.kind]}</strong> between{" "}
                      <strong>{describeWho(rule.who, groups)}</strong> who were{" "}
                      <strong>{WHEN_LABEL[rule.when.kind]}</strong>
                      {rule.except.length > 0 && (
                        <>
                          {" "}except{" "}
                          {rule.except
                            .map(e => describeExcept(e, groups))
                            .join(", ")}
                        </>
                      )}
                    </li>
                  ))}
                  <li>
                    <em>Default:</em> split the rest{" "}
                    <strong>{HOW_LABEL[policy.config.fallback.how.kind]}</strong>{" "}
                    between{" "}
                    <strong>
                      {describeWho(policy.config.fallback.who, groups)}
                    </strong>{" "}
                    who were{" "}
                    <strong>
                      {WHEN_LABEL[policy.config.fallback.when.kind]}
                    </strong>
                    {policy.config.fallback.except.length > 0 && (
                      <>
                        {" "}except{" "}
                        {policy.config.fallback.except
                          .map(e => describeExcept(e, groups))
                          .join(", ")}
                      </>
                    )}
                  </li>
                </ol>
              </Card.Block>
              {canEdit && (
                <Card.Block data-size="sm">
                  <Button
                    type="button"
                    data-size="sm"
                    onClick={() => { loadForEdit(policy) }}
                    disabled={pending}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    data-size="sm"
                    onClick={() => {
                      deleteMutation.mutate({
                        id: policy.id,
                        property_id: propertyId,
                      })
                    }}
                    disabled={pending}
                  >
                    Delete
                  </Button>
                </Card.Block>
              )}
            </article>
          </Card>
          )
        })
      )}
    </section>
  )
}
