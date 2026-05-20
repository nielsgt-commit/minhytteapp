import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Divider, Heading, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./PlannedMaintenanceSummary.module.css"

type Severity = "major" | "minor" | "patch"

function severityColor(
  items: { severity: Severity }[],
): "info" | "warning" | "danger" {
  if (items.some(i => i.severity === "major")) return "danger"
  if (items.some(i => i.severity === "minor")) return "warning"
  return "info"
}

function startOfSunday(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

type Props = {
  mode: "this-week" | "rest"
  weekStart?: Date
}

export default function PlannedMaintenanceSummary({ mode, weekStart }: Props) {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: items } = useSuspenseQuery(
    trpc.maintenance.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const wkStart = weekStart ?? startOfSunday(new Date())
  const wkEnd = new Date(wkStart)
  wkEnd.setDate(wkEnd.getDate() + 7)

  const pending = items.filter(
    i => i.status === "todo" || i.status === "doing",
  )
  const inWeek = (due: Date | string | null) => {
    if (due == null) return false
    const d = new Date(due)
    return d >= wkStart && d < wkEnd
  }
  const filtered =
    mode === "this-week"
      ? pending.filter(i => inWeek(i.due_at))
      : pending.filter(i => !inWeek(i.due_at))

  const itemsByStructure = new Map<number, typeof filtered>()
  for (const it of filtered) {
    if (it.structure_id == null) continue
    const bucket = itemsByStructure.get(it.structure_id) ?? []
    bucket.push(it)
    itemsByStructure.set(it.structure_id, bucket)
  }

  const structuresWithItems = structures.filter(b => itemsByStructure.has(b.id))

  return (
    <>
      <Divider className={styles.divider} />
      <Heading level={6} size="medium">{t("Planned Maintenance")}</Heading>
      {structuresWithItems.length === 0 ? (
        <p>{t("No planned maintenance.")}</p>
      ) : (
        <ul className={styles.tagList}>
          {structuresWithItems.map(b => {
            const bucket = itemsByStructure.get(b.id) ?? []
            return (
              <Tag key={b.id} data-color={severityColor(bucket)}>
                {t("{{name}} ({{count}} open)", { name: b.name, count: bucket.length })}
              </Tag>
            )
          })}
        </ul>
      )}
    </>

  )
}