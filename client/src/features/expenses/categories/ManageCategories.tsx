import { useRef } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Card,
  EXPERIMENTAL_Suggestion as Suggestion,
  Paragraph,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useCategoryMutations } from "@/features/expenses/expenseform/useCategoryMutations.ts"

export function ManageCategories() {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const canManageCategories =
    me != null &&
    (me.is_admin ||
      (propertyId != null && me.head_property_ids.includes(propertyId)))
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions({ property_id: propertyId ?? 0 }),
  )
  const suggestionInputRef = useRef<HTMLInputElement>(null)
  const { selectedCats, handleCategoriesChange, createError, archiveError } =
    useCategoryMutations(categories, suggestionInputRef, propertyId)

  if (!canManageCategories) {
    return (
      <Card asChild>
        <section>
          <Paragraph>
            {t("Only property heads can manage expense categories.")}
          </Paragraph>
        </section>
      </Card>
    )
  }

  return (
    <Card asChild>
      <section>
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
            {categories.map(c => (
              <Suggestion.Option key={c.id} value={String(c.id)}>
                {c.name}
              </Suggestion.Option>
            ))}
          </Suggestion.List>
        </Suggestion>
        {createError && (
          <ValidationMessage>
            {t("Error: {{message}}", { message: createError.message })}
          </ValidationMessage>
        )}
        {archiveError && (
          <ValidationMessage>
            {t("Error: {{message}}", { message: archiveError.message })}
          </ValidationMessage>
        )}
      </section>
    </Card>
  )
}
