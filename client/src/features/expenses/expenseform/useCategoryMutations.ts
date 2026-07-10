import type { RefObject } from "react"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import {
  useCategorySuggestions,
  type Category,
} from "@/hooks/useCategorySuggestions"

export function useCategoryMutations(
  categories: Category[],
  suggestionInputRef: RefObject<HTMLInputElement | null>,
  propertyId: number | null,
) {
  const trpc = useTRPC()
  const categoryKey = [
    trpc.expenseCategory.list.queryKey({ property_id: propertyId ?? 0 }),
  ]
  const create = useMutationWithInvalidation(
    trpc.expenseCategory.create.mutationOptions(),
    categoryKey,
  )
  const archive = useMutationWithInvalidation(
    trpc.expenseCategory.archive.mutationOptions(),
    categoryKey,
  )
  const status = useMutationsStatus(create, archive)
  const { selectedCats, handleCategoriesChange } = useCategorySuggestions(
    categories,
    suggestionInputRef,
    propertyId,
    { create, archive },
  )
  return { selectedCats, handleCategoriesChange, status }
}
