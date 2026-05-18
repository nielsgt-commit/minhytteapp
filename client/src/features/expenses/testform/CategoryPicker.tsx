import type { Ref } from "react"
import {
  Chip,
  EXPERIMENTAL_Suggestion as Suggestion,
} from "@digdir/designsystemet-react"
import type { SuggestionItem } from "@digdir/designsystemet-react"
import styles from "./AddNewExpenseFlow.module.css"

type Category = { id: number; name: string }

type Props = {
  categories: Category[]
  editMode: boolean
  selectedCats: SuggestionItem[]
  onCategoriesChange: (next: SuggestionItem[]) => void
  suggestionInputRef: Ref<HTMLInputElement>
  pending: boolean
  openCategory: string | null
  onOpenCategory: (name: string) => void
}

export function CategoryPicker({
  categories,
  editMode,
  selectedCats,
  onCategoriesChange,
  suggestionInputRef,
  pending,
  openCategory,
  onOpenCategory,
}: Props) {
  if (editMode) {
    return (
      <Suggestion
        multiple
        creatable
        selected={selectedCats}
        onSelectedChange={onCategoriesChange}
      >
        <Suggestion.Input
          ref={suggestionInputRef}
          placeholder="Add or remove categories"
        />
        <Suggestion.List>
          {categories.map(c => (
            <Suggestion.Option key={c.id} value={String(c.id)}>
              {c.name}
            </Suggestion.Option>
          ))}
        </Suggestion.List>
      </Suggestion>
    )
  }
  return (
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
  )
}
