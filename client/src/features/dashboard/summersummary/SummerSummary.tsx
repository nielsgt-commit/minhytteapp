import { Suspense, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ToggleGroup } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { defaultYear } from "@/routes/_authed/manageproperty/-priority/priorityUtils"
import type { PeakWeek } from "@/routes/_authed/manageproperty/-priority/priorityUtils"
import PriorityWeekSummary from "./PriorityWeekSummary"
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

  const weeks = Array.from(
    new Set(
      priority.assignments
        .map(a => a.iso_week)
        .filter((w): w is PeakWeek => w === 28 || w === 29 || w === 30),
    ),
  ).sort((a, b) => a - b)

  if (weeks.length === 0) {
    return <p>{t("No priority weeks set.")}</p>
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
      {weeks.map(week => (
        <Suspense key={week} fallback={<p>{t("Loading…")}</p>}>
          <PriorityWeekSummary
            propertyId={propertyId}
            year={year}
            week={week}
            sort={sort}
          />
        </Suspense>
      ))}
    </div>
  )
}
