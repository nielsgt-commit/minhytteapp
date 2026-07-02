import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ToggleGroup } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useTRPC } from "@/trpc/trpc"
import { defaultYear } from "@/routes/_authed/administrer/-priority/priorityUtils"
import {
  groupAssignmentsBySeason,
  weekRangeForSeason,
} from "@/features/seasons/seasonUtils"
import { PriorityWeekSummary } from "./PriorityWeekSummary"
import styles from "./SummerSummary.module.css"

export type SortMode = "building" | "weekday"

export function SummerSummary({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const year = defaultYear()
  const [sort, setSort] = useState<SortMode>("building")

  const { data: priority } = useSuspenseQuery(
    trpc.priority.list.queryOptions({ property_id: propertyId, year }),
  )
  const { data: seasons } = useSuspenseQuery(
    trpc.season.list.queryOptions({ property_id: propertyId }),
  )

  // Resolve every assigned priority week to its concrete dates. With no
  // seasons configured, picks resolve within the plain year (the original
  // behavior); with seasons, each pick resolves inside its season's instance
  // starting that year, which handles weeks after New Year in a cross-year
  // season. Legacy picks matching no season keep the plain-year resolution.
  const weekEntries = new Map<number, ReturnType<typeof weekRangeForSeason>>()
  if (seasons.length === 0) {
    for (const a of priority.assignments) {
      weekEntries.set(a.iso_week, weekRangeForSeason(null, year, a.iso_week))
    }
  } else {
    const { bySeason, unadopted } = groupAssignmentsBySeason(
      seasons,
      priority.assignments,
    )
    for (const s of seasons) {
      for (const a of bySeason.get(s.id) ?? []) {
        weekEntries.set(a.iso_week, weekRangeForSeason(s, year, a.iso_week))
      }
    }
    for (const a of unadopted) {
      weekEntries.set(a.iso_week, weekRangeForSeason(null, year, a.iso_week))
    }
  }

  const weeks = [...weekEntries.entries()]
    .map(([week, range]) => ({ week, range }))
    .sort((a, b) => Temporal.PlainDate.compare(a.range.start, b.range.start))

  if (weeks.length === 0) {
    return <EmptyState title={t("No priority weeks set.")} />
  }

  return (
    <div className={styles.list}>
      <ToggleGroup
        value={sort}
        onChange={value => {
          setSort(value as SortMode)
        }}
        data-size="sm"
        data-toggle-group={t("Sort stays")}
        className={styles.sort}
      >
        <ToggleGroup.Item value="building">{t("Building")}</ToggleGroup.Item>
        <ToggleGroup.Item value="weekday">{t("Weekday")}</ToggleGroup.Item>
      </ToggleGroup>
      {weeks.map(({ week, range }) => (
        <QueryBoundary key={`${String(week)}-${range.start.toString()}`}>
          <PriorityWeekSummary
            propertyId={propertyId}
            week={week}
            range={range}
            sort={sort}
          />
        </QueryBoundary>
      ))}
    </div>
  )
}
