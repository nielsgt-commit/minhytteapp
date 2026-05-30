import { useRef } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Card,
  EXPERIMENTAL_Suggestion as Suggestion,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useCategoryMutations } from "@/features/expenses/testform/useCategoryMutations.ts"

export function ManageCategories() {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const canManageCategories = me != null && (me.is_head || me.is_admin)
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions(),
  )
  const suggestionInputRef = useRef<HTMLInputElement>(null)
  const { selectedCats, handleCategoriesChange, createError, archiveError } =
    useCategoryMutations(categories, suggestionInputRef)

  if (!canManageCategories) {
    return (
      <Card asChild>
        <section>
          <p>{t("Only property heads can manage expense categories.")}</p>
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
