import type { Ref } from "react"
import {
  Chip,
  Divider,
  EXPERIMENTAL_Suggestion as Suggestion,
} from "@digdir/designsystemet-react"
import type { SuggestionItem } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./AddNewExpenseFlow.module.css"

type Category = { id: number; name: string }

type Props = {
  categories: Category[]
  canManage: boolean
  selectedCats: SuggestionItem[]
  onCategoriesChange: (next: SuggestionItem[]) => void
  suggestionInputRef: Ref<HTMLInputElement>
  pending: boolean
  openCategory: string | null
  onOpenCategory: (name: string) => void
}

export function CategoryPicker({
  categories,
  canManage,
  selectedCats,
  onCategoriesChange,
  suggestionInputRef,
  pending,
  openCategory,
  onOpenCategory,
}: Props) {
  const { t } = useTranslation("expenses")
  return (
    <>
      <div className={styles.chipGroup}>
        {categories.map(c => (
          <Chip.Button
            key={c.id}
            type="button"
            disabled={pending || openCategory === c.name}
            onClick={() => { onOpenCategory(c.name) }}
          >
            {c.name}
          </Chip.Button>
        ))}
      </div>
      {canManage && (
        <>
          <Divider />
          <Suggestion
            multiple
            creatable
            selected={selectedCats}
            onSelectedChange={onCategoriesChange}
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
        </>
      )}
    </>
  )
}
