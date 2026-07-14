import { Chip } from "@digdir/designsystemet-react"
import styles from "./AddNewExpenseFlow.module.css"

type Category = { id: number; name: string }

type Props = {
  categories: Category[]
  pending: boolean
  openCategory: string | null
  onOpenCategory: (name: string) => void
}

export function CategoryPicker({
  categories,
  pending,
  openCategory,
  onOpenCategory,
}: Props) {
  return (
    <div className={styles.chipGroup}>
      {categories.map(c => (
        <Chip.Button
          key={c.id}
          type="button"
          data-size="lg"
          disabled={pending || openCategory === c.name}
          onClick={() => {
            onOpenCategory(c.name)
          }}
        >
          {c.name}
        </Chip.Button>
      ))}
    </div>
  )
}
