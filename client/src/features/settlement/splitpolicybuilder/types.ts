export type What = { kind: "total" } | { kind: "category"; category_id: number }

export type How =
  | { kind: "equally" }
  | { kind: "weighted_by_occupancy" }
  | { kind: "by_ownership_pct" }

export type Who =
  | { kind: "all_users" }
  | { kind: "user_group"; group_id: number }
  | { kind: "user"; user_id: number }
  | { kind: "heads_only" }
  | { kind: "main_groups" }

export type When =
  | { kind: "always" }
  | { kind: "present_when_expense_added" }
  | { kind: "present_this_year" }
  | { kind: "during_any_priority_week" }
  | { kind: "during_priority_week"; user_group_id: number }

export type ExceptItem =
  | { kind: "user"; user_id: number }
  | { kind: "group"; group_id: number }
  | { kind: "kids" }

export type Rule = {
  what: What
  how: How
  who: Who[]
  except: ExceptItem[]
  when: When
  include_extra_guests: boolean
}

export type Fallback = Omit<Rule, "what">

export type FormState = {
  id: number | null
  name: string
  rules: Rule[]
  fallback: Fallback
}

export const DEFAULT_FALLBACK: Fallback = {
  how: { kind: "equally" },
  who: [{ kind: "all_users" }],
  except: [],
  when: { kind: "always" },
  include_extra_guests: false,
}

export const NEW_RULE: Rule = {
  what: { kind: "total" },
  how: { kind: "equally" },
  who: [{ kind: "all_users" }],
  except: [],
  when: { kind: "always" },
  include_extra_guests: false,
}

export const OCCUPANCY_DAYS_PRESET: Omit<FormState, "id" | "name"> = {
  rules: [],
  fallback: {
    how: { kind: "weighted_by_occupancy" },
    who: [{ kind: "main_groups" }],
    except: [],
    when: { kind: "always" },
    include_extra_guests: true,
  },
}

export const INITIAL_FORM: FormState = {
  id: null,
  name: "",
  rules: [],
  fallback: DEFAULT_FALLBACK,
}

export const HOW_LABEL: Record<How["kind"], string> = {
  equally: "equally",
  weighted_by_occupancy: "by days stayed",
  by_ownership_pct: "by ownership percentage",
}

export type StaticWhen = Exclude<When, { kind: "during_priority_week" }>

export const WHEN_LABEL: Record<StaticWhen["kind"], string> = {
  always: "anytime",
  present_when_expense_added: "present when expense was added",
  present_this_year: "present this year",
  during_any_priority_week: "during any priority week",
}

export function encodeWhen(w: When): string {
  if (w.kind === "during_priority_week") {
    return `during_priority_week:${String(w.user_group_id)}`
  }
  return w.kind
}

export function decodeWhen(v: string): When {
  if (v.startsWith("during_priority_week:")) {
    return {
      kind: "during_priority_week",
      user_group_id: Number(v.slice("during_priority_week:".length)),
    }
  }
  return { kind: v as StaticWhen["kind"] }
}

export function encodeWhat(w: What): string {
  return w.kind === "total" ? "total" : `category:${String(w.category_id)}`
}

export function decodeWhat(v: string): What {
  if (v === "total") return { kind: "total" }
  const id = Number(v.slice("category:".length))
  return { kind: "category", category_id: id }
}

export function encodeWho(w: Who): string {
  switch (w.kind) {
    case "all_users":
      return "all_users"
    case "heads_only":
      return "heads_only"
    case "main_groups":
      return "main_groups"
    case "user_group":
      return `user_group:${String(w.group_id)}`
    case "user":
      return `user:${String(w.user_id)}`
  }
}

export function decodeWho(v: string): Who {
  if (v === "all_users") return { kind: "all_users" }
  if (v === "heads_only") return { kind: "heads_only" }
  if (v === "main_groups") return { kind: "main_groups" }
  if (v.startsWith("user_group:"))
    return {
      kind: "user_group",
      group_id: Number(v.slice("user_group:".length)),
    }
  if (v.startsWith("user:"))
    return { kind: "user", user_id: Number(v.slice("user:".length)) }
  return { kind: "all_users" }
}

export function encodeExcept(item: ExceptItem): string {
  if (item.kind === "kids") return "kids"
  return item.kind === "user"
    ? `user:${String(item.user_id)}`
    : `group:${String(item.group_id)}`
}

export function decodeExcept(v: string): ExceptItem | null {
  if (v === "kids") return { kind: "kids" }
  if (v.startsWith("user:")) {
    return { kind: "user", user_id: Number(v.slice("user:".length)) }
  }
  if (v.startsWith("group:")) {
    return { kind: "group", group_id: Number(v.slice("group:".length)) }
  }
  return null
}

export type GroupWithMembers = {
  id: number
  name: string
  is_family: boolean
  members: { user_id: number; user_name: string }[]
}

export type EligibleOwner = {
  user_group_id: number
  user_group_name: string
}

export type Category = { id: number; name: string }

export type PropertyUser = { user_id: number; user_name: string }

export function nameForGroup(groups: GroupWithMembers[], id: number) {
  return groups.find(g => g.id === id)?.name ?? `group #${String(id)}`
}

export function nameForUser(groups: GroupWithMembers[], id: number) {
  for (const g of groups) {
    const m = g.members.find(mm => mm.user_id === id)
    if (m) return m.user_name
  }
  return `user #${String(id)}`
}

export function nameForCategory(categories: Category[], id: number) {
  return categories.find(c => c.id === id)?.name ?? `category #${String(id)}`
}

export function describeWhat(w: What, categories: Category[]) {
  return w.kind === "total"
    ? "total"
    : nameForCategory(categories, w.category_id)
}

export function describeWho(w: Who, groups: GroupWithMembers[]): string {
  switch (w.kind) {
    case "all_users":
      return "all users"
    case "heads_only":
      return "heads of this property"
    case "main_groups":
      return "main owner groups"
    case "user_group":
      return `group "${nameForGroup(groups, w.group_id)}"`
    case "user":
      return nameForUser(groups, w.user_id)
  }
}

export function describeWhoList(
  who: Who[],
  groups: GroupWithMembers[],
): string {
  if (who.length === 0) return "nobody"
  return who.map(w => describeWho(w, groups)).join(", ")
}

export function describeExcept(item: ExceptItem, groups: GroupWithMembers[]) {
  if (item.kind === "kids") return "Kids"
  return item.kind === "user"
    ? nameForUser(groups, item.user_id)
    : `group "${nameForGroup(groups, item.group_id)}"`
}

export function describeWhen(w: When, eligibleOwners: EligibleOwner[]): string {
  if (w.kind === "during_priority_week") {
    const owner = eligibleOwners.find(
      o => o.user_group_id === w.user_group_id,
    )
    return owner
      ? `${owner.user_group_name}'s priority week`
      : `priority week (group #${String(w.user_group_id)})`
  }
  return WHEN_LABEL[w.kind]
}

export function allUsersInProperty(groups: GroupWithMembers[]): PropertyUser[] {
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

export function normalizeWho(raw: unknown): Who[] {
  if (Array.isArray(raw)) return raw as Who[]
  if (raw != null && typeof raw === "object") return [raw as Who]
  return [{ kind: "all_users" }]
}
