import { useState } from "react"
import type { SavedPolicy } from "./SavedPolicies"
import {
  DEFAULT_OCCUPANCY,
  type EligibleOwner,
  type ExceptItem,
  type Fallback,
  type FormState,
  type GroupWithMembers,
  type How,
  INITIAL_FORM,
  NEW_RULE,
  type Rule,
  SPLIT_POLICY_PARAMETERS,
  type SplitPolicyOccupancy,
  type SplitPolicyParameter,
  type When,
  type Who,
  decodeExcept,
  decodeWho,
  encodeExcept,
  encodeWho,
  normalizeWhat,
  normalizeWho,
  participantsFromWho,
  sanitizeConfigForParameters,
} from "./types"

// The builder has no parameter toggles anymore — every option (categories,
// participants, person-days, ownership, time conditions) is always available in
// the sentence. So the form always holds the full parameter set; the minimal set
// actually exercised is derived from the config at save time (see
// deriveParameters), which is what keeps booking_days/phases honest.
function withAllParameters(): SplitPolicyParameter[] {
  return [...SPLIT_POLICY_PARAMETERS]
}

// Person-days rules scope participation by stay, so a "who were present" clause
// is redundant — the builder hides it. Clear it on load so a legacy saved policy
// doesn't keep silently filtering participants under a hidden clause.
function clearRedundantPresence<T extends { how: How; when: When }>(
  clause: T,
): T {
  return clause.how.kind === "weighted_by_occupancy"
    ? { ...clause, when: { kind: "always" } }
    : clause
}

// Pure state transforms for the policy builder form: rule list ordering,
// who/except membership and loading saved policies for editing.
// `groups`/`eligibleOwners` resolve a clause's participants so exclusions that
// fall outside the (possibly narrowed) who-set are dropped automatically.
export function useSplitPolicyForm(
  groups: GroupWithMembers[],
  eligibleOwners: EligibleOwner[],
) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  // Keep only exclusions that still name a current participant — a user/group in
  // the resolved who-set (kids is a cross-cutting filter, always kept).
  const pruneExcept = (who: Who[], except: ExceptItem[]): ExceptItem[] => {
    const { userIds, groupIds } = participantsFromWho(who, groups, eligibleOwners)
    return except.filter(
      e =>
        e.kind === "kids" ||
        (e.kind === "user" && userIds.has(e.user_id)) ||
        (e.kind === "group" && groupIds.has(e.group_id)),
    )
  }

  // Bring a loaded clause in line with the live builder rules: drop a redundant
  // presence clause on person-days rules and any exclusion outside its who-set.
  const normalizeClause = <
    T extends { who: Who[]; how: How; when: When; except: ExceptItem[] },
  >(
    clause: T,
  ): T => {
    const c = clearRedundantPresence(clause)
    return { ...c, except: pruneExcept(c.who, c.except) }
  }

  const setName = (name: string) => {
    setForm(f => ({ ...f, name }))
  }

  const patchOccupancy = (patch: Partial<SplitPolicyOccupancy>) => {
    setForm(f => ({ ...f, occupancy: { ...f.occupancy, ...patch } }))
  }

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
      const already = rule.except.some(e => encodeExcept(e) === encoded)
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
      const already = f.fallback.except.some(e => encodeExcept(e) === encoded)
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
        rules: f.rules.map((r, i) => {
          if (i !== idx) return r
          const who = [...r.who, item]
          return { ...r, who, except: pruneExcept(who, r.except) }
        }),
      }
    })
  }

  const removeWhoFromRule = (idx: number, encoded: string) => {
    setForm(f => ({
      ...f,
      rules: f.rules.map((r, i) => {
        if (i !== idx) return r
        const who = r.who.filter(w => encodeWho(w) !== encoded)
        return { ...r, who, except: pruneExcept(who, r.except) }
      }),
    }))
  }

  const addWhoToFallback = (encoded: string) => {
    if (encoded === "") return
    const item = decodeWho(encoded)
    setForm(f => {
      if (f.fallback.who.some(w => encodeWho(w) === encoded)) return f
      const who = [...f.fallback.who, item]
      return {
        ...f,
        fallback: { ...f.fallback, who, except: pruneExcept(who, f.fallback.except) },
      }
    })
  }

  const removeWhoFromFallback = (encoded: string) => {
    setForm(f => {
      const who = f.fallback.who.filter(w => encodeWho(w) !== encoded)
      return {
        ...f,
        fallback: { ...f.fallback, who, except: pruneExcept(who, f.fallback.except) },
      }
    })
  }

  // Load a saved policy for editing. The builder exposes every option, so we
  // hold the full parameter set (the saved minimal set is re-derived on save).
  // sanitize still runs to migrate legacy occupancy/when fields via
  // resolveOccupancy; with all parameters allowed it never strips clauses.
  const loadForEdit = (policy: SavedPolicy) => {
    const parameters = withAllParameters()
    const rules = policy.config.rules.map(r => ({
      ...r,
      what: normalizeWhat(r.what),
      who: normalizeWho(r.who),
    })) as unknown as Rule[]
    const fallback = {
      ...policy.config.fallback,
      who: normalizeWho(policy.config.fallback.who),
    } as unknown as Fallback
    const clean = sanitizeConfigForParameters({
      parameters,
      rules,
      fallback,
      occupancy: policy.config.occupancy,
    })
    setForm({
      id: policy.id,
      name: policy.name,
      parameters,
      rules: (clean.rules as Rule[]).map(normalizeClause),
      fallback: normalizeClause(clean.fallback as Fallback),
      occupancy: clean.occupancy ?? DEFAULT_OCCUPANCY,
    })
  }

  // Reset to a fresh form. With no parameter toggles, the form always holds the
  // full parameter set so every option stays available in the sentence builder.
  const reset = () => {
    setForm({ ...INITIAL_FORM, parameters: withAllParameters() })
  }

  return {
    form,
    setName,
    patchOccupancy,
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
    loadForEdit,
    reset,
  }
}
