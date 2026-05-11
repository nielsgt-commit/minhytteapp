import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

export function CategorySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const trpc = useTRPC()
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions(),
  )
  const known = categories.some(c => c.name === value)
  return (
    <select
      value={value}
      onChange={e => { onChange(e.target.value) }}
    >
      <option value="">(none)</option>
      {!known && value !== "" && <option value={value}>{value}</option>}
      {categories.map(c => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
    </select>
  )
}
