import type { RefObject } from "react"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import {
  useCategorySuggestions,
  type Category,
} from "@/hooks/useCategorySuggestions"

export function useEquipmentCategoryMutations(
  categories: Category[],
  suggestionInputRef: RefObject<HTMLInputElement | null>,
  propertyId: number | null,
) {
  const trpc = useTRPC()
  const categoryKey = [
    trpc.equipmentCategory.list.queryKey({ property_id: propertyId ?? 0 }),
  ]
  const create = useMutationWithInvalidation(
    trpc.equipmentCategory.create.mutationOptions(),
    categoryKey,
  )
  const archive = useMutationWithInvalidation(
    trpc.equipmentCategory.archive.mutationOptions(),
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
