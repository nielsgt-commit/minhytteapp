import { Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { Category } from "./types"

type Props = {
  categories: Category[]
  selectedIds: Set<number>
  onAdd: (id: number) => void
}

// Inline "add a category" dropdown — sits in the rule sentence right after the
// selected category chips, mirroring WhoPicker. Picking a category narrows the
// rule from "all categories (totals)" to the chosen ones; the placeholder
// doubles as the label and signals the empty (= all) state.
export function CategoryPicker({ categories, selectedIds, onAdd }: Props) {
  const { t } = useTranslation("settlement")
  return (
    <Select
      aria-label={t("Add expense category")}
      data-size="sm"
      value=""
      onChange={e => {
        if (e.target.value === "") return
        onAdd(Number(e.target.value))
        e.target.value = ""
      }}
    >
      <Select.Option value="">
        {selectedIds.size === 0
          ? t("— all categories; pick to narrow —")
          : t("— add a category —")}
      </Select.Option>
      {categories.map(c => (
        <Select.Option
          key={c.id}
          value={String(c.id)}
          disabled={selectedIds.has(c.id)}
        >
          {c.name}
        </Select.Option>
      ))}
    </Select>
  )
}
