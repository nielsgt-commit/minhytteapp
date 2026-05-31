import { useEffect } from "react"
import { useAppDispatch } from "@/app/hooks"
import {
  type PriorityWeekHolder,
  setPriorityYearAssignments,
} from "./prioritySlice"
import type { EligibleOwner, PriorityAssignment } from "./priorityUtils"

type PriorityListData = {
  eligibleOwners: readonly EligibleOwner[]
  assignments: readonly PriorityAssignment[]
}

/**
 * Mirror the query result into the Redux slice so other features
 * (e.g. ExperimentalWeekPanel) can read selectPriorityHolderForWeek
 * without re-fetching.
 */
export function usePrioritySliceSync(
  data: PriorityListData | undefined,
  year: number,
): void {
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!data) return
    const ownerById = new Map(
      data.eligibleOwners.map(o => [o.user_group_id, o.user_group_name]),
    )
    const next: Record<number, PriorityWeekHolder> = {}
    for (const a of data.assignments) {
      const groupName = ownerById.get(a.user_group_id)
      if (groupName == null) continue
      next[a.iso_week] = {
        userGroupId: a.user_group_id,
        userGroupName: groupName,
      }
    }
    dispatch(setPriorityYearAssignments({ year, assignments: next }))
  }, [data, year, dispatch])
}
