import { useSelectedPropertyId } from "@/selection/useSelection"
import type { ReactNode } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Divider, Heading, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { Temporal } from "temporal-polyfill"
import {
  isoWeekNumber,
  isoWeekYear,
  startOfSunday,
  toDateInputValue,
} from "@/utils/dateUtils"
import {
  priorityGroupLabel,
  staticDueKindLabel,
} from "@/features/maintenance/due/maintenanceDue.ts"
import { buildOwnerLookups } from "@/routes/_authed/administrer/-priority/priorityUtils.ts"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import styles from "./PlannedMaintenanceSummary.module.css"

type Severity = "major" | "minor" | "patch"

function severityColor(
  items: { severity: Severity }[],
): "info" | "warning" | "danger" {
  if (items.some(i => i.severity === "major")) return "danger"
  if (items.some(i => i.severity === "minor")) return "warning"
  return "info"
}

type Props = {
  mode: "this-week" | "rest"
  weekStart?: Temporal.PlainDate
}

export function PlannedMaintenanceSummary({ mode, weekStart }: Props) {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: items } = useSuspenseQuery(
    trpc.maintenance.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const wkStart = weekStart ?? startOfSunday(Temporal.Now.plainDateISO())
  const wkEnd = wkStart.add({ days: 7 })
  const refMid = wkStart.add({ days: 3 })
  const refWeek = isoWeekNumber(refMid)
  const refYear = isoWeekYear(refMid)

  // Suspense (not plain useQuery) so render waits for the assignments before
  // bucketing — otherwise priority_week items flash into the wrong bucket while
  // this loads. Safe to run unconditionally: the sibling suspense queries above
  // already require a positive property_id, so this only mounts with a real one.
  const { data: priority } = useSuspenseQuery(
    trpc.priority.list.queryOptions({ property_id: propertyId, year: refYear }),
  )
  const { ownerNameById, weekByGroup } = buildOwnerLookups(
    priority.eligibleOwners,
    priority.assignments,
  )

  type Item = (typeof items)[number]
  const pending = items.filter(i => i.status === "todo" || i.status === "doing")

  const inDisplayedWeek = (i: Item) => {
    if (i.due_kind === "date") {
      if (i.due_at == null) return false
      // Compare the due instant's Oslo day against the displayed week.
      const d = toDateInputValue(i.due_at)
      return d >= wkStart.toString() && d < wkEnd.toString()
    }
    if (i.due_kind === "priority_week" && i.due_priority_group_id != null) {
      return weekByGroup.get(i.due_priority_group_id) === refWeek
    }
    return false
  }

  const renderStructureTags = (list: Item[]) => {
    const byStructure = new Map<number, Item[]>()
    for (const it of list) {
      if (it.structure_id == null) continue
      const bucket = byStructure.get(it.structure_id) ?? []
      bucket.push(it)
      byStructure.set(it.structure_id, bucket)
    }
    const withItems = structures.filter(b => byStructure.has(b.id))
    if (withItems.length === 0) return null
    return (
      <ul className={styles.tagList}>
        {withItems.map(b => {
          const bucket = byStructure.get(b.id) ?? []
          return (
            <Tag key={b.id} data-color={severityColor(bucket)}>
              {t("{{name}} ({{count}} open)", {
                name: b.name,
                count: bucket.length,
              })}
            </Tag>
          )
        })}
      </ul>
    )
  }

  return (
    <>
      <Heading level={6} data-size="sm">
        {t("Planned Maintenance")}
      </Heading>
      <Divider className={styles.divider} />
      {mode === "this-week"
        ? renderThisWeek(
            pending.filter(inDisplayedWeek),
            renderStructureTags,
            t,
          )
        : renderRest(
            pending.filter(i => !inDisplayedWeek(i)),
            renderStructureTags,
            ownerNameById,
            weekByGroup,
            t,
          )}
    </>
  )
}

function renderThisWeek<Item>(
  filtered: Item[],
  renderStructureTags: (list: Item[]) => ReactNode,
  t: TFunction,
) {
  const tags = renderStructureTags(filtered)
  if (tags == null) return <EmptyState title={t("No planned maintenance.")} />
  return tags
}

type DueItem = {
  due_kind:
    | "not_decided"
    | "dugnad"
    | "opening"
    | "closing"
    | "priority_week"
    | "date"
  due_priority_group_id?: number | null
}

function renderRest<Item extends DueItem>(
  rest: Item[],
  renderStructureTags: (list: Item[]) => ReactNode,
  ownerNameById: Map<number, string>,
  weekByGroup: Map<number, number>,
  t: TFunction,
) {
  type Bucket = { items: Item[]; label: string; order: number }
  const buckets = new Map<string, Bucket>()

  const add = (key: string, label: string, order: number, item: Item) => {
    const bucket = buckets.get(key)
    if (bucket) bucket.items.push(item)
    else buckets.set(key, { items: [item], label, order })
  }

  for (const it of rest) {
    if (it.due_kind === "priority_week" && it.due_priority_group_id != null) {
      const gid = it.due_priority_group_id
      const name = ownerNameById.get(gid) ?? t("Unknown group")
      const week = weekByGroup.get(gid)
      const label = week
        ? `${priorityGroupLabel(t, name)} (${t("week {{week}}", { week })})`
        : priorityGroupLabel(t, name)
      add(`group:${String(gid)}`, label, week ?? 99, it)
    } else if (
      it.due_kind === "dugnad" ||
      it.due_kind === "opening" ||
      it.due_kind === "closing"
    ) {
      const order =
        it.due_kind === "opening" ? 100 : it.due_kind === "dugnad" ? 101 : 102
      add(it.due_kind, staticDueKindLabel(t, it.due_kind), order, it)
    } else if (it.due_kind === "date") {
      add("scheduled", t("Scheduled"), 200, it)
    } else {
      add("unscheduled", t("Not decided"), 300, it)
    }
  }

  const ordered = [...buckets.entries()].sort(
    ([, a], [, b]) => a.order - b.order,
  )

  if (ordered.length === 0)
    return <EmptyState title={t("No planned maintenance.")} />

  return (
    <div className={styles.buckets}>
      {ordered.map(([key, bucket]) => {
        const tags = renderStructureTags(bucket.items)
        if (tags == null) return null
        return (
          <div key={key} className={styles.bucket}>
            <span className={styles.bucketLabel}>{bucket.label}</span>
            {tags}
          </div>
        )
      })}
    </div>
  )
}
