import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type PriorityWeekHolder = {
  ownerId: number
  userId: number
  userName: string
}

export type PrioritySliceState = {
  byYear: Record<number, Record<number, PriorityWeekHolder>>
}

const initialState: PrioritySliceState = {
  byYear: {},
}

export const prioritySlice = createAppSlice({
  name: "priority",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setYearAssignments: create.reducer(
      (
        state,
        action: PayloadAction<{
          year: number
          assignments: Record<number, PriorityWeekHolder>
        }>,
      ) => {
        state.byYear[action.payload.year] = action.payload.assignments
      },
    ),
  }),
  selectors: {
    selectHolderForWeek: (
      state,
      year: number,
      week: number,
    ): PriorityWeekHolder | null => state.byYear[year]?.[week] ?? null,
  },
})

export const {
  reset: resetPriority,
  setYearAssignments: setPriorityYearAssignments,
} = prioritySlice.actions

export const { selectHolderForWeek: selectPriorityHolderForWeek } =
  prioritySlice.selectors
