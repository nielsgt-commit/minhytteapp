import type { RefObject } from "react"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import {
  useCategorySuggestions,
  type Category,
} from "@/hooks/useCategorySuggestions"
import type { InventoryCategoryKind } from "@server/shared/inventoryCategoryDefaults.ts"

export function useInventoryCategoryMutations(
  categories: Category[],
  suggestionInputRef: RefObject<HTMLInputElement | null>,
  propertyId: number | null,
  kind: InventoryCategoryKind,
) {
  const trpc = useTRPC()
  // The list is queried with different kind filters (per list page and the
  // admin panel), so invalidate the whole router path rather than one key.
  const categoryKeys = [trpc.inventoryCategory.pathKey()]
  const create = useMutationWithInvalidation(
    trpc.inventoryCategory.create.mutationOptions(),
    categoryKeys,
  )
  const archive = useMutationWithInvalidation(
    trpc.inventoryCategory.archive.mutationOptions(),
    categoryKeys,
  )
  const status = useMutationsStatus(create, archive)
  const { selectedCats, handleCategoriesChange } = useCategorySuggestions(
    categories,
    suggestionInputRef,
    propertyId,
    {
      // useCategorySuggestions' create contract has no kind; the panel's kind
      // is injected here.
      create: {
        mutate: vars => {
          create.mutate({ ...vars, kind })
        },
      },
      archive,
    },
  )
  return { selectedCats, handleCategoriesChange, status }
}
