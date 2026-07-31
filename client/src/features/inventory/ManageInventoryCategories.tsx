import { useRef } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Card,
  EXPERIMENTAL_Suggestion as Suggestion,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useInventoryCategoryMutations } from "./useInventoryCategoryMutations"
import type { InventoryCategoryKind } from "@server/shared/inventoryCategoryDefaults.ts"

// Admin page: the property's inventory categories, one panel per kind (food
// list on /handleliste, general list on /inventar). Mirrors the equipment
// categories panel: type to add, remove a chip to archive. Archiving a
// category that still has items is refused by the server.
export function ManageInventoryCategories() {
  return (
    <QueryBoundary>
      <ManageInventoryCategoriesContent />
    </QueryBoundary>
  )
}

function ManageInventoryCategoriesContent() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const canManageCategories =
    me != null &&
    (me.is_admin ||
      (propertyId != null && me.head_property_ids.includes(propertyId)))
  const { data: categories } = useSuspenseQuery(
    trpc.inventoryCategory.list.queryOptions({ property_id: propertyId ?? 0 }),
  )

  if (!canManageCategories) {
    return (
      <Card asChild>
        <section>
          <Paragraph>
            {t("Only property heads can manage inventory categories.")}
          </Paragraph>
        </section>
      </Card>
    )
  }

  return (
    <>
      <KindPanel
        propertyId={propertyId}
        kind="food"
        heading={t("Food categories")}
        description={t(
          "Sections of the food inventory on the shopping list page.",
        )}
        categories={categories.filter(c => c.kind === "food")}
      />
      <KindPanel
        propertyId={propertyId}
        kind="general"
        heading={t("General categories")}
        description={t("Sections of the general inventory page.")}
        categories={categories.filter(c => c.kind === "general")}
      />
    </>
  )
}

function KindPanel({
  propertyId,
  kind,
  heading,
  description,
  categories,
}: {
  propertyId: number | null
  kind: InventoryCategoryKind
  heading: string
  description: string
  categories: { id: number; name: string }[]
}) {
  const { t: tInventory } = useTranslation("inventory")
  // Default category names are stored in English and translated for display,
  // matching their labels on the inventory lists; custom names render as-is.
  const tName = tInventory as (
    key: string,
    options?: { defaultValue: string },
  ) => string
  const { t } = useTranslation("property")
  const displayCategories = categories.map(c => ({
    id: c.id,
    name: tName(c.name, { defaultValue: c.name }),
  }))
  const suggestionInputRef = useRef<HTMLInputElement>(null)
  const { selectedCats, handleCategoriesChange, status } =
    useInventoryCategoryMutations(
      displayCategories,
      suggestionInputRef,
      propertyId,
      kind,
    )

  return (
    <Card asChild>
      <section>
        <Heading level={3} data-size="xs">
          {heading}
        </Heading>
        <Paragraph data-size="sm">{description}</Paragraph>
        <Suggestion
          multiple
          creatable
          selected={selectedCats}
          onSelectedChange={handleCategoriesChange}
        >
          <Suggestion.Input
            ref={suggestionInputRef}
            placeholder={t("Add or remove categories")}
          />
          <Suggestion.List>
            {displayCategories.map(c => (
              <Suggestion.Option key={c.id} value={String(c.id)}>
                {c.name}
              </Suggestion.Option>
            ))}
          </Suggestion.List>
        </Suggestion>
        <ErrorAlert error={status.error} />
      </section>
    </Card>
  )
}
