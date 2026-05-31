import { type RefObject, useEffect, useState } from "react"
import type { SuggestionItem } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"

type Category = { id: number; name: string }

const toSuggestionItems = (cats: Category[]): SuggestionItem[] =>
  cats.map(c => ({ label: c.name, value: String(c.id) }))

export function useCategoryMutations(
  categories: Category[],
  suggestionInputRef: RefObject<HTMLInputElement | null>,
  propertyId: number | null,
) {
  const trpc = useTRPC()

  const [selectedCats, setSelectedCats] = useState<SuggestionItem[]>(
    toSuggestionItems(categories),
  )

  useEffect(() => {
    setSelectedCats(toSuggestionItems(categories))
  }, [categories])

  const categoryKey = [
    trpc.expenseCategory.list.queryKey({ property_id: propertyId ?? 0 }),
  ]
  const createCategoryMutation = useMutationWithInvalidation(
    trpc.expenseCategory.create.mutationOptions(),
    categoryKey,
  )
  const archiveCategoryMutation = useMutationWithInvalidation(
    trpc.expenseCategory.archive.mutationOptions(),
    categoryKey,
  )

  const handleCategoriesChange = (next: SuggestionItem[]) => {
    const prevValues = new Set(selectedCats.map(s => s.value))
    const nextValues = new Set(next.map(s => s.value))
    for (const item of selectedCats) {
      if (nextValues.has(item.value)) continue
      const id = Number(item.value)
      if (Number.isInteger(id) && id > 0) {
        archiveCategoryMutation.mutate({ property_id: propertyId ?? 0, id })
      }
    }
    let created = false
    for (const item of next) {
      if (prevValues.has(item.value)) continue
      const name = item.label.trim()
      if (name.length > 0) {
        createCategoryMutation.mutate({ property_id: propertyId ?? 0, name })
        created = true
      }
    }
    setSelectedCats(next)
    if (created && suggestionInputRef.current) {
      const input = suggestionInputRef.current
      input.value = ""
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }

  return {
    selectedCats,
    handleCategoriesChange,
    createError: createCategoryMutation.error,
    archiveError: archiveCategoryMutation.error,
  }
}
