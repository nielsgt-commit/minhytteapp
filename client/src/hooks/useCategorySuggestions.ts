import { useMemo, useState, type RefObject } from "react"
import type { SuggestionItem } from "@digdir/designsystemet-react"

export type Category = { id: number; name: string }

const toSuggestionItems = (cats: Category[]): SuggestionItem[] =>
  cats.map(c => ({ label: c.name, value: String(c.id) }))

// Shared core of the category Suggestion pickers (expense and equipment
// categories). The wrappers own the feature-specific tRPC wiring — list
// query key, create/archive mutations, status — and inject the mutate
// functions; everything else (delta state, selection merge, change handling)
// is identical and lives here.
export function useCategorySuggestions(
  categories: Category[],
  suggestionInputRef: RefObject<HTMLInputElement | null>,
  propertyId: number | null,
  mutations: {
    create: { mutate: (vars: { property_id: number; name: string }) => void }
    archive: { mutate: (vars: { property_id: number; id: number }) => void }
  },
) {
  // The server list is the base; user adds/removals are kept as deltas so a
  // refetch reflects them instead of wiping an in-flight selection change.
  const [pendingAdds, setPendingAdds] = useState<SuggestionItem[]>([])
  const [removedValues, setRemovedValues] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const serverItems = useMemo(() => toSuggestionItems(categories), [categories])
  const serverLabels = new Set(serverItems.map(s => s.label))
  const selectedCats = [
    ...serverItems.filter(s => !removedValues.has(s.value)),
    ...pendingAdds.filter(p => !serverLabels.has(p.label)),
  ]

  const handleCategoriesChange = (next: SuggestionItem[]) => {
    const prevValues = new Set(selectedCats.map(s => s.value))
    const nextValues = new Set(next.map(s => s.value))

    const removed = selectedCats.filter(item => !nextValues.has(item.value))
    for (const item of removed) {
      const id = Number(item.value)
      if (Number.isInteger(id) && id > 0) {
        mutations.archive.mutate({ property_id: propertyId ?? 0, id })
      }
    }

    const added = next.filter(
      item => !prevValues.has(item.value) && item.label.trim().length > 0,
    )
    for (const item of added) {
      mutations.create.mutate({
        property_id: propertyId ?? 0,
        name: item.label.trim(),
      })
    }

    if (removed.length > 0) {
      const values = new Set(removed.map(r => r.value))
      setRemovedValues(prev => new Set([...prev, ...values]))
      setPendingAdds(prev => prev.filter(p => !values.has(p.value)))
    }
    if (added.length > 0) {
      setPendingAdds(prev => [...prev, ...added])
      if (suggestionInputRef.current) {
        const input = suggestionInputRef.current
        input.value = ""
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
    }
  }

  return { selectedCats, handleCategoriesChange }
}
