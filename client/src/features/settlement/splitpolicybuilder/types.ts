import type {
  SplitPolicyOccupancy,
  SplitPolicyParameter,
} from "@server/shared/splitPolicy.ts"
// Imported as values (not just re-exported) because INITIAL_FORM and
// deriveParameters reference them locally — `export ... from` alone would not
// create a local binding.
import {
  DEFAULT_OCCUPANCY,
  normalizeParameters,
  normalizeWhat,
} from "@server/shared/splitPolicy.ts"

export { DEFAULT_OCCUPANCY, normalizeParameters, normalizeWhat }

export {
  CHILD_WEIGHTS,
  SPLIT_POLICY_PARAMETERS,
  type SplitPolicyConfig,
  type SplitPolicyOccupancy,
  type SplitPolicyOccupancyWindow,
  type SplitPolicyParameter,
  allowedHowKinds,
  allowedWhenKinds,
  allowedWindowKinds,
  allowsCategoryRules,
  allowsCustomParticipants,
  allowsExtraGuests,
  configViolations,
  resolveOccupancy,
  sanitizeConfigForParameters,
} from "@server/shared/splitPolicy.ts"

export type What =
  | { kind: "total" }
  | { kind: "category"; category_ids: number[] }

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

// Participant-eligibility filter ("who is on the hook"). Priority-week kinds mean
// "present during that week"; the separate Occupancy.window controls how
// person-days are counted.
export type When =
  | { kind: "always" }
  | { kind: "present_when_expense_added" }
  | { kind: "present_this_year" }
  | { kind: "present_any_priority_week" }
  | { kind: "present_priority_week"; user_group_id: number }

export type OccupancyWindow =
  | { kind: "year" }
  | { kind: "any_priority_week" }
  | { kind: "priority_week"; user_group_id: number }
  // A manually picked month/day range (inclusive, `MM-DD`), resolved against the
  // settlement year. `from_md > to_md` wraps across the new year.
  | { kind: "custom_range"; from_md: string; to_md: string }

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
}

export type Fallback = Omit<Rule, "what">

export type FormState = {
  id: number | null
  name: string
  parameters: SplitPolicyParameter[]
  rules: Rule[]
  fallback: Fallback
  occupancy: SplitPolicyOccupancy
}

// Which builder options the chosen parameters allow, computed once per render
// in SplitPolicyBuilder and passed down as props.
export type AllowedOptions = {
  howKinds: Set<How["kind"]>
  whenKinds: Set<When["kind"]>
  windowKinds: Set<OccupancyWindow["kind"]>
  priorityWeeks: boolean
  categories: boolean
  participants: boolean
  extraGuests: boolean
}

export const DEFAULT_FALLBACK: Fallback = {
  how: { kind: "equally" },
  who: [{ kind: "all_users" }],
  except: [],
  when: { kind: "always" },
}

export const NEW_RULE: Rule = {
  what: { kind: "total" },
  how: { kind: "equally" },
  who: [{ kind: "all_users" }],
  except: [],
  when: { kind: "always" },
}

export const INITIAL_FORM: FormState = {
  id: null,
  name: "",
  parameters: [
    "booking_days",
    "ownership",
    "expense_categories",
    "time_conditions",
    "participants",
  ],
  // Start with one "all categories (totals)" rule so the per-category select is
  // visible by default (replacing the old "Expense totals" radio default).
  rules: [NEW_RULE],
  fallback: DEFAULT_FALLBACK,
  occupancy: DEFAULT_OCCUPANCY,
}

// English strings translated through t() at render time, like HOW_LABEL.
export const PARAMETER_LABEL: Record<SplitPolicyParameter, string> = {
  booking_days: "Use stay data",
  ownership: "Use ownership shares",
  expense_categories: "Expense categories",
  time_conditions: "Include time conditions",
  participants: "Participants",
}

export const PARAMETER_DESCRIPTION: Record<SplitPolicyParameter, string> = {
  booking_days:
    "Use who-stayed-how-many-nights data — enables splitting by days stayed, extra guests, the booking-review step and time conditions.",
  ownership: "Allow splitting by ownership percentage.",
  expense_categories: "Allow different rules per expense category.",
  time_conditions:
    "Restrict each rule to people present in a time window — when the expense was added, this year, or during a priority week.",
  participants:
    "Choose exactly who takes part instead of the main owner groups.",
}

// The minimal parameter set a config actually exercises. The builder exposes
// every option (there are no parameter toggles), so on save we derive the
// parameters from what the rules/fallback/occupancy use. This keeps booking_days
// — and therefore the settlement's booking-collection phase and person-day
// counting — on only when a clause splits by person-days or filters on
// presence/priority weeks. expense_categories and participants carry no
// settlement-flow cost, so they ride along whenever rules exist (categories are
// always picked per rule, and who/except must never be silently reset on save).
export function deriveParameters(config: {
  rules: { how: How; when: When }[]
  fallback: { how: How; when: When }
  occupancy: SplitPolicyOccupancy
}): SplitPolicyParameter[] {
  const clauses = [...config.rules, config.fallback]
  const usesOccupancyHow = clauses.some(
    c => c.how.kind === "weighted_by_occupancy",
  )
  const usesOwnership = clauses.some(c => c.how.kind === "by_ownership_pct")
  const usesWhen = clauses.some(c => c.when.kind !== "always")
  // Only the priority-week windows need time-conditions data; "year" and the
  // manually picked "custom_range" stand alone.
  const windowKind = config.occupancy.window.kind
  const usesPriorityWindow =
    usesOccupancyHow &&
    (windowKind === "any_priority_week" || windowKind === "priority_week")
  const usesTimeConditions = usesWhen || usesPriorityWindow

  const params: SplitPolicyParameter[] = []
  if (config.rules.length > 0) params.push("expense_categories")
  params.push("participants")
  if (usesOccupancyHow || usesTimeConditions) params.push("booking_days")
  if (usesTimeConditions) params.push("time_conditions")
  if (usesOwnership) params.push("ownership")
  return normalizeParameters(params)
}

export const HOW_LABEL: Record<How["kind"], string> = {
  equally: "equally",
  weighted_by_occupancy: "by person-days",
  by_ownership_pct: "by ownership percentage",
}

// Static (no user_group_id) when kinds; "present_priority_week" is encoded with
// its id and labelled per-group, like the occupancy window's "priority_week".
type StaticWhen = Exclude<When, { kind: "present_priority_week" }>

export const WHEN_LABEL: Record<StaticWhen["kind"], string> = {
  always: "anytime",
  present_when_expense_added: "present when expense was added",
  present_this_year: "present this year",
  present_any_priority_week: "present during any priority week",
}

export function encodeWhen(w: When): string {
  if (w.kind === "present_priority_week") {
    return `present_priority_week:${String(w.user_group_id)}`
  }
  return w.kind
}

export function decodeWhen(v: string): When {
  if (v.startsWith("present_priority_week:")) {
    return {
      kind: "present_priority_week",
      user_group_id: Number(v.slice("present_priority_week:".length)),
    }
  }
  return { kind: v as StaticWhen["kind"] }
}

// Window kinds carrying no extra fields, so they round-trip through a single
// Select value. "priority_week" (id) and "custom_range" (dates) are handled
// separately in encode/decodeWindow.
type StaticWindow = Exclude<
  OccupancyWindow,
  { kind: "priority_week" } | { kind: "custom_range" }
>

export const WINDOW_LABEL: Record<StaticWindow["kind"], string> = {
  year: "all stays this year",
  any_priority_week: "stays during any priority week",
}

// Shown as the Select option for the manual-range kind; the dates themselves are
// picked in the two date inputs that appear once it's selected.
export const CUSTOM_RANGE_LABEL = "stays in a date range I set"

// The manual range stores month/day only (resolved against the settlement year).
// Native <input type="date"> still needs a year, so the inputs round-trip through
// a fixed reference year — a leap year, so 02-29 stays selectable. The year is
// never persisted or shown as meaningful.
export const MD_REF_YEAR = "2024"

// "MM-DD" <-> the "YYYY-MM-DD" value a date input expects. Empty stays empty so a
// freshly selected range shows blank inputs.
export function mdToInputDate(md: string): string {
  return md === "" ? "" : `${MD_REF_YEAR}-${md}`
}

export function inputDateToMd(value: string): string {
  return value === "" ? "" : value.slice(5)
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// "07-01" -> "Jul 1" for the read-only summary; passthrough for malformed input.
export function mdLabel(md: string): string {
  const m = /^(\d{2})-(\d{2})$/.exec(md)
  if (m == null) return md
  const monthIdx = Number(m[1]) - 1
  if (monthIdx < 0 || monthIdx >= MONTH_ABBR.length) return md
  return `${MONTH_ABBR[monthIdx]} ${String(Number(m[2]))}`
}

export function encodeWindow(w: OccupancyWindow): string {
  if (w.kind === "priority_week") {
    return `priority_week:${String(w.user_group_id)}`
  }
  return w.kind
}

// Switching *to* the manual range starts with empty dates for the user to fill;
// editing the dates of an already-selected range goes through patchOccupancy and
// never round-trips through here.
export function decodeWindow(v: string): OccupancyWindow {
  if (v.startsWith("priority_week:")) {
    return {
      kind: "priority_week",
      user_group_id: Number(v.slice("priority_week:".length)),
    }
  }
  if (v === "custom_range") {
    return { kind: "custom_range", from_md: "", to_md: "" }
  }
  return { kind: v as StaticWindow["kind"] }
}

// English strings (translated at render time). Keyed by the numeric weight as a
// string so the values line up with CHILD_WEIGHTS.
export const CHILD_WEIGHT_LABEL: Record<string, string> = {
  "1": "a full person",
  "0.5": "half a person",
  "0": "nothing",
}

export function childWeightLabel(weight: number): string {
  return CHILD_WEIGHT_LABEL[String(weight)] ?? CHILD_WEIGHT_LABEL["1"]
}

// A rule's `what` is now multi-category. These helpers add/remove a single id
// and collapse an empty selection back to "total" (every expense). normalizeWhat
// keeps them safe against legacy rows that still carry a single `category_id`.
export function categoryIds(w: What): number[] {
  const n = normalizeWhat(w)
  return n.kind === "category" ? n.category_ids : []
}

export function addCategory(w: What, id: number): What {
  const ids = categoryIds(w)
  if (ids.includes(id)) return w
  return { kind: "category", category_ids: [...ids, id] }
}

export function removeCategory(w: What, id: number): What {
  const ids = categoryIds(w).filter(c => c !== id)
  return ids.length > 0 ? { kind: "category", category_ids: ids } : { kind: "total" }
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
  members: { user_id: number; user_name: string; is_head: boolean }[]
}

export type EligibleOwner = {
  user_group_id: number
  user_group_name: string
}

export type Category = { id: number; name: string }

export type PropertyUser = { user_id: number; user_name: string }

// Resolve a rule's `who` to the concrete people (and whole groups) it includes,
// so the exclude picker can only offer participants. Mirrors the server's
// expandWho: main owner groups come from eligibleOwners; heads are is_head
// members of family groups. A group is "excludable" only when every one of its
// members is already a participant.
export function participantsFromWho(
  who: Who[],
  groups: GroupWithMembers[],
  eligibleOwners: EligibleOwner[],
): { userIds: Set<number>; groupIds: Set<number> } {
  const mainGroupIds = new Set(eligibleOwners.map(o => o.user_group_id))
  const userIds = new Set<number>()
  const addGroupMembers = (g: GroupWithMembers) => {
    for (const m of g.members) userIds.add(m.user_id)
  }

  for (const w of who) {
    switch (w.kind) {
      case "all_users":
        groups.forEach(addGroupMembers)
        break
      case "main_groups":
        groups.filter(g => mainGroupIds.has(g.id)).forEach(addGroupMembers)
        break
      case "heads_only":
        for (const g of groups) {
          if (!g.is_family) continue
          for (const m of g.members) if (m.is_head) userIds.add(m.user_id)
        }
        break
      case "user_group":
        groups.filter(g => g.id === w.group_id).forEach(addGroupMembers)
        break
      case "user":
        userIds.add(w.user_id)
        break
    }
  }

  const groupIds = new Set<number>()
  for (const g of groups) {
    if (g.members.length > 0 && g.members.every(m => userIds.has(m.user_id))) {
      groupIds.add(g.id)
    }
  }
  return { userIds, groupIds }
}

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
  const ids = categoryIds(w)
  return ids.length === 0
    ? "total"
    : ids.map(id => nameForCategory(categories, id)).join(", ")
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

export function describeWhen(
  w: When,
  eligibleOwners: EligibleOwner[] = [],
): string {
  if (w.kind === "present_priority_week") {
    const owner = eligibleOwners.find(o => o.user_group_id === w.user_group_id)
    return owner
      ? `present during ${owner.user_group_name}'s priority week`
      : `present during a priority week (group #${String(w.user_group_id)})`
  }
  return WHEN_LABEL[w.kind]
}

export function describeWindow(
  w: OccupancyWindow,
  eligibleOwners: EligibleOwner[],
): string {
  if (w.kind === "priority_week") {
    const owner = eligibleOwners.find(o => o.user_group_id === w.user_group_id)
    return owner
      ? `stays during ${owner.user_group_name}'s priority week`
      : `stays during a priority week (group #${String(w.user_group_id)})`
  }
  if (w.kind === "custom_range") {
    return w.from_md && w.to_md
      ? `stays between ${mdLabel(w.from_md)} and ${mdLabel(w.to_md)} each year`
      : "stays in a date range I set"
  }
  return WINDOW_LABEL[w.kind]
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
