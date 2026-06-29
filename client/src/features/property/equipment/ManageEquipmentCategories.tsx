import { useRef } from "react"
import {
  Card,
  EXPERIMENTAL_Suggestion as Suggestion,
  Heading,
  Paragraph,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { useEquipmentCategoryMutations } from "./useEquipmentCategoryMutations"
import styles from "./EquipmentPanel.module.css"

type Category = { id: number; name: string }

export function ManageEquipmentCategories({
  categories,
  propertyId,
}: {
  categories: Category[]
  propertyId: number | null
}) {
  const { t } = useTranslation("property")
  const suggestionInputRef = useRef<HTMLInputElement>(null)
  const { selectedCats, handleCategoriesChange, status } =
    useEquipmentCategoryMutations(categories, suggestionInputRef, propertyId)

  return (
    <Card asChild className={styles.categoriesCard}>
      <section>
        <Heading level={3} data-size="xs">
          {t("Equipment categories")}
        </Heading>
        <Paragraph data-size="sm">
          {t(
            "Labels you can tag equipment with. Add or remove the options shown in the category field below.",
          )}
        </Paragraph>
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
        <ErrorAlert error={status.error} />
      </section>
    </Card>
  )
}
