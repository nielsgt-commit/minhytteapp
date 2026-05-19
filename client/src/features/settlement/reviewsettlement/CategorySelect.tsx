import { useSuspenseQuery } from "@tanstack/react-query"
import { Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"

export function CategorySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions(),
  )
  const known = categories.some(c => c.name === value)
  return (
    <Select
      value={value}
      onChange={e => { onChange(e.target.value) }}
    >
      <Select.Option value="">{t("(none)")}</Select.Option>
      {!known && value !== "" && <Select.Option value={value}>{value}</Select.Option>}
      {categories.map(c => (
        <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>
      ))}
    </Select>
  )
}
