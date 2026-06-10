import { useSuspenseQuery } from "@tanstack/react-query"
import { Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useSelectedPropertyId } from "@/selection/useSelection"

export function CategorySelect({
  name,
  defaultValue,
}: {
  name: string
  defaultValue: string
}) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const known = categories.some(c => c.name === defaultValue)
  return (
    <Select name={name} defaultValue={defaultValue}>
      <Select.Option value="">{t("(none)")}</Select.Option>
      {!known && defaultValue !== "" && (
        <Select.Option value={defaultValue}>{defaultValue}</Select.Option>
      )}
      {categories.map(c => (
        <Select.Option key={c.id} value={c.name}>
          {c.name}
        </Select.Option>
      ))}
    </Select>
  )
}
