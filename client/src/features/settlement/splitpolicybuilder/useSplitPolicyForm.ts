import { useState } from "react"
import type { SavedPolicy } from "./SavedPolicies"
import {
  type Fallback,
  type FormState,
  INITIAL_FORM,
  NEW_RULE,
  OCCUPANCY_DAYS_PRESET,
  type Rule,
  decodeExcept,
  decodeWho,
  encodeExcept,
  encodeWho,
  normalizeWho,
} from "./types"

// Pure state transforms for the policy builder form: rule list ordering,
// who/except membership and loading presets or saved policies for editing.
export function useSplitPolicyForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  const setName = (name: string) => {
    setForm(f => ({ ...f, name }))
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
        i === idx
          ? { ...r, who: r.who.filter(w => encodeWho(w) !== encoded) }
          : r,
      ),
    }))
  }

  const addWhoToFallback = (encoded: string) => {
    if (encoded === "") return
    const item = decodeWho(encoded)
    setForm(f => {
      if (f.fallback.who.some(w => encodeWho(w) === encoded)) return f
      return {
        ...f,
        fallback: { ...f.fallback, who: [...f.fallback.who, item] },
      }
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
        include_extra_guests:
          policy.config.fallback.include_extra_guests ?? false,
      },
    })
  }

  const reset = () => {
    setForm(INITIAL_FORM)
  }

  return {
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
  }
}
