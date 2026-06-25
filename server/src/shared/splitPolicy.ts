// Shared between server and client (via the @server alias) like transformer.ts.
// Must stay free of server-only imports so the client bundle doesn't pull them in.

export type SplitPolicyWhat =
  | { kind: "total" }
  | { kind: "category"; category_ids: number[] }

// Configs persist as untyped JSON and are not re-validated on read, so legacy
// rows still carry the old single `category_id`. Normalize at every edge that
// consumes a stored `what` (calc + builder load) so both the old and the new
// multi-category shape resolve to one canonical form. An empty/invalid category
// selection collapses to "total" (match every expense).
export function normalizeWhat(raw: unknown): SplitPolicyWhat {
  if (raw == null || typeof raw !== "object") return { kind: "total" }
  const w = raw as {
    kind?: unknown
    category_id?: unknown
    category_ids?: unknown
  }
  if (w.kind !== "category") return { kind: "total" }
  const ids = Array.isArray(w.category_ids)
    ? w.category_ids
    : typeof w.category_id === "number"
      ? [w.category_id]
      : []
  const category_ids = [...new Set(ids.filter(id => typeof id === "number"))]
  return category_ids.length > 0
    ? { kind: "category", category_ids }
    : { kind: "total" }
}

export type SplitPolicyHow =
  | { kind: "equally" }
  | { kind: "weighted_by_occupancy" }
  | { kind: "by_ownership_pct" }

export type SplitPolicyWho =
  | { kind: "all_users" }
  | { kind: "user_group"; group_id: number }
  | { kind: "user"; user_id: number }
  | { kind: "heads_only" }
  | { kind: "main_groups" }

// `when` is now a pure participant-eligibility filter ("who is on the hook for
// this expense"). Priority-week kinds here mean "present during that week" as a
// participant filter; the separate SplitPolicyOccupancy.window controls how
// person-days are *counted* (a different concern).
export type SplitPolicyWhen =
  | { kind: "always" }
  | { kind: "present_when_expense_added" }
  | { kind: "present_this_year" }
  | { kind: "present_any_priority_week" }
  | { kind: "present_priority_week"; user_group_id: number }

export type SplitPolicyExcept =
  | { kind: "user"; user_id: number }
  | { kind: "group"; group_id: number }
  | { kind: "kids" }

export type SplitPolicyRule = {
  what: SplitPolicyWhat
  how: SplitPolicyHow
  who: SplitPolicyWho[]
  except: SplitPolicyExcept[]
  when: SplitPolicyWhen
}

export type SplitPolicyFallback = Omit<SplitPolicyRule, "what">

// How a person-day is *counted* — one shared definition per policy, used wherever
// `weighted_by_occupancy` appears. `window` scopes which nights count toward the
// weight (the whole year, or only nights overlapping priority weeks);
// `child_weight` scales a child's nights; `include_extra_guests` adds the extra
// guest names recorded on a booking to the booker's tally.
export type SplitPolicyOccupancyWindow =
  | { kind: "year" }
  | { kind: "any_priority_week" }
  | { kind: "priority_week"; user_group_id: number }
  // A manually picked month/day range (inclusive, `MM-DD`), resolved against the
  // settlement's year so one policy reused across years always scopes to the same
  // calendar window. `from_md > to_md` wraps across the new year (e.g. a winter
  // range). Independent of priority-week data, so it's always available.
  | { kind: "custom_range"; from_md: string; to_md: string }

export type SplitPolicyOccupancy = {
  window: SplitPolicyOccupancyWindow
  include_extra_guests: boolean
  child_weight: number
}

export const CHILD_WEIGHTS = [1, 0.5, 0] as const

export const DEFAULT_OCCUPANCY: SplitPolicyOccupancy = {
  window: { kind: "year" },
  include_extra_guests: false,
  child_weight: 1,
}

export const SPLIT_POLICY_PARAMETERS = [
  "booking_days",
  "ownership",
  "expense_categories",
  "time_conditions",
  "participants",
] as const

export type SplitPolicyParameter = (typeof SPLIT_POLICY_PARAMETERS)[number]

export type SplitPolicyConfig = {
  // Absent on configs saved before parameters existed = all enabled.
  parameters?: SplitPolicyParameter[]
  rules: SplitPolicyRule[]
  fallback: SplitPolicyFallback
  // Absent on configs saved before person-day counting was its own section;
  // resolveOccupancy() fills it in (migrating from legacy per-rule fields).
  occupancy?: SplitPolicyOccupancy
}

// Absent => all enabled. Otherwise: map the legacy "priority_weeks" parameter
// to "time_conditions" (which now gates every when-clause, not just priority
// weeks), drop duplicates, and enforce the invariant that time conditions need
// stay data — they evaluate against bookings, so time_conditions only makes
// sense alongside booking_days.
export function normalizeParameters(
  parameters: readonly SplitPolicyParameter[] | undefined,
): SplitPolicyParameter[] {
  if (parameters == null) return [...SPLIT_POLICY_PARAMETERS]
  const seen = new Set<SplitPolicyParameter>()
  const deduped: SplitPolicyParameter[] = []
  for (const raw of parameters) {
    const p = (raw as string) === "priority_weeks" ? "time_conditions" : raw
    if (seen.has(p)) continue
    seen.add(p)
    deduped.push(p)
  }
  return deduped.filter(
    p => p !== "time_conditions" || deduped.includes("booking_days"),
  )
}

export const DEFAULT_WHO: SplitPolicyWho[] = [{ kind: "main_groups" }]

export function allowedHowKinds(
  parameters: readonly SplitPolicyParameter[],
): Set<SplitPolicyHow["kind"]> {
  const kinds = new Set<SplitPolicyHow["kind"]>(["equally"])
  if (parameters.includes("booking_days")) kinds.add("weighted_by_occupancy")
  if (parameters.includes("ownership")) kinds.add("by_ownership_pct")
  return kinds
}

export function allowedWhenKinds(
  parameters: readonly SplitPolicyParameter[],
): Set<SplitPolicyWhen["kind"]> {
  const kinds = new Set<SplitPolicyWhen["kind"]>(["always"])
  if (parameters.includes("time_conditions")) {
    kinds.add("present_when_expense_added")
    kinds.add("present_this_year")
    kinds.add("present_any_priority_week")
    kinds.add("present_priority_week")
  }
  return kinds
}

// Which person-day windows the parameters allow. "year" and a manually picked
// "custom_range" are always available; priority-week windows need the
// time-conditions data.
export function allowedWindowKinds(
  parameters: readonly SplitPolicyParameter[],
): Set<SplitPolicyOccupancyWindow["kind"]> {
  const kinds = new Set<SplitPolicyOccupancyWindow["kind"]>([
    "year",
    "custom_range",
  ])
  if (parameters.includes("time_conditions")) {
    kinds.add("any_priority_week")
    kinds.add("priority_week")
  }
  return kinds
}

// Best-effort read of legacy per-rule fields (include_extra_guests, priority-week
// `when`) into the new shared occupancy object, for policies saved before this
// section existed. Reads through `unknown` because those fields are gone from the
// current types.
function migrateLegacyOccupancy(
  config: SplitPolicyConfig,
): SplitPolicyOccupancy {
  const clauses = [...config.rules, config.fallback] as unknown as {
    when?: { kind?: string; user_group_id?: number }
    include_extra_guests?: boolean
  }[]
  let window: SplitPolicyOccupancyWindow = { kind: "year" }
  let includeExtras = false
  for (const c of clauses) {
    if (c.include_extra_guests === true) includeExtras = true
    if (window.kind !== "year") continue
    if (c.when?.kind === "during_any_priority_week") {
      window = { kind: "any_priority_week" }
    } else if (
      c.when?.kind === "during_priority_week" &&
      c.when.user_group_id != null
    ) {
      window = { kind: "priority_week", user_group_id: c.when.user_group_id }
    }
  }
  return { window, include_extra_guests: includeExtras, child_weight: 1 }
}

// The effective occupancy for a config under a parameter set: defaults filled in,
// legacy fields migrated, and every field clamped to what the parameters allow
// (no priority-week window without time_conditions; no extras/child-weight
// without stay data).
export function resolveOccupancy(
  config: SplitPolicyConfig,
  parameters: readonly SplitPolicyParameter[],
): SplitPolicyOccupancy {
  const raw = config.occupancy ?? migrateLegacyOccupancy(config)
  const bookingDays = parameters.includes("booking_days")
  const windows = allowedWindowKinds(parameters)
  return {
    window: windows.has(raw.window.kind) ? raw.window : { kind: "year" },
    include_extra_guests: bookingDays ? raw.include_extra_guests : false,
    child_weight: bookingDays ? raw.child_weight : 1,
  }
}

export function allowsCategoryRules(
  parameters: readonly SplitPolicyParameter[],
): boolean {
  return parameters.includes("expense_categories")
}

export function allowsCustomParticipants(
  parameters: readonly SplitPolicyParameter[],
): boolean {
  return parameters.includes("participants")
}

export function allowsExtraGuests(
  parameters: readonly SplitPolicyParameter[],
): boolean {
  return parameters.includes("booking_days")
}

function isDefaultWho(who: readonly SplitPolicyWho[]): boolean {
  return who.length === 1 && who[0].kind === "main_groups"
}

export type ConfigViolation = {
  target: "rule" | "fallback"
  index: number | null
  field: "what" | "how" | "when" | "who" | "except"
  parameter: SplitPolicyParameter
}

function ruleViolations(
  rule: SplitPolicyRule | SplitPolicyFallback,
  parameters: readonly SplitPolicyParameter[],
  target: "rule" | "fallback",
  index: number | null,
): ConfigViolation[] {
  const violations: ConfigViolation[] = []
  const at = (
    field: ConfigViolation["field"],
    parameter: SplitPolicyParameter,
  ) => violations.push({ target, index, field, parameter })

  if (!allowedHowKinds(parameters).has(rule.how.kind)) {
    at(
      "how",
      rule.how.kind === "by_ownership_pct" ? "ownership" : "booking_days",
    )
  }
  if (!allowedWhenKinds(parameters).has(rule.when.kind)) {
    at("when", "time_conditions")
  }
  if (!allowsCustomParticipants(parameters)) {
    if (!isDefaultWho(rule.who)) at("who", "participants")
    if (rule.except.length > 0) at("except", "participants")
  }
  return violations
}

// Rules only exist to treat categories differently from the fallback, so any
// rule at all requires the expense_categories parameter.
export function configViolations(config: SplitPolicyConfig): ConfigViolation[] {
  const parameters = normalizeParameters(config.parameters)
  const violations: ConfigViolation[] = []
  config.rules.forEach((rule, index) => {
    if (!allowsCategoryRules(parameters)) {
      violations.push({
        target: "rule",
        index,
        field: "what",
        parameter: "expense_categories",
      })
    }
    violations.push(...ruleViolations(rule, parameters, "rule", index))
  })
  violations.push(
    ...ruleViolations(config.fallback, parameters, "fallback", null),
  )
  return violations
}

function sanitizeRule<T extends SplitPolicyRule | SplitPolicyFallback>(
  rule: T,
  parameters: readonly SplitPolicyParameter[],
): T {
  return {
    ...rule,
    how: allowedHowKinds(parameters).has(rule.how.kind)
      ? rule.how
      : { kind: "equally" as const },
    when: allowedWhenKinds(parameters).has(rule.when.kind)
      ? rule.when
      : { kind: "always" as const },
    who: allowsCustomParticipants(parameters) ? rule.who : [...DEFAULT_WHO],
    except: allowsCustomParticipants(parameters) ? rule.except : [],
  }
}

export function sanitizeConfigForParameters(
  config: SplitPolicyConfig,
): SplitPolicyConfig {
  const parameters = normalizeParameters(config.parameters)
  return {
    ...config,
    rules: allowsCategoryRules(parameters)
      ? config.rules.map(r => sanitizeRule(r, parameters))
      : [],
    fallback: sanitizeRule(config.fallback, parameters),
    occupancy: resolveOccupancy(config, parameters),
  }
}

export const SETTLEMENT_PHASES = [
  "collecting_expenses",
  "collecting_bookings",
  "reviewing",
  "split_policy",
  "closed",
] as const

export type SettlementPhase = (typeof SETTLEMENT_PHASES)[number]

export function phaseAtLeast(
  current: SettlementPhase,
  target: SettlementPhase,
): boolean {
  return SETTLEMENT_PHASES.indexOf(current) >= SETTLEMENT_PHASES.indexOf(target)
}

export function requiredPhases(
  parameters: readonly SplitPolicyParameter[],
): SettlementPhase[] {
  return SETTLEMENT_PHASES.filter(
    p => p !== "collecting_bookings" || parameters.includes("booking_days"),
  )
}

// "First required phase after current in the canonical order" so navigation
// stays correct even when the settlement sits in a phase that is no longer
// required (the policy can be edited mid-settlement). "closed" is never an
// advance target — closing only happens through acceptSplit.
export function nextPhaseIn(
  required: readonly SettlementPhase[],
  current: SettlementPhase,
): SettlementPhase | null {
  const idx = SETTLEMENT_PHASES.indexOf(current)
  for (const p of required) {
    if (p === "closed") continue
    if (SETTLEMENT_PHASES.indexOf(p) > idx) return p
  }
  return null
}

export function prevPhaseIn(
  required: readonly SettlementPhase[],
  current: SettlementPhase,
): SettlementPhase | null {
  if (current === "closed") return null
  const idx = SETTLEMENT_PHASES.indexOf(current)
  let prev: SettlementPhase | null = null
  for (const p of required) {
    if (p === "closed") continue
    if (SETTLEMENT_PHASES.indexOf(p) < idx) prev = p
  }
  return prev
}
