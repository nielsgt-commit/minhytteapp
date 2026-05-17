import { useEffect } from "react"
import { useAppDispatch } from "@/app/hooks"
import {
  type PriorityWeekHolder,
  setPriorityYearAssignments,
} from "@/features/priority/prioritySlice"
import type {
  EligibleOwner,
  PriorityAssignment,
} from "@/features/priority/priorityUtils"

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
      data.eligibleOwners.map(o => [
        o.property_owner_id,
        { userId: o.user_id, userName: o.user_name },
      ]),
    )
    const next: Record<number, PriorityWeekHolder> = {}
    for (const a of data.assignments) {
      const owner = ownerById.get(a.property_owner_id)
      if (!owner) continue
      next[a.iso_week] = {
        ownerId: a.property_owner_id,
        userId: owner.userId,
        userName: owner.userName,
      }
    }
    dispatch(setPriorityYearAssignments({ year, assignments: next }))
  }, [data, year, dispatch])
}
