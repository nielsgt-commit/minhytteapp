import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type CalendarStatus = "idle" | "loading" | "failed"

export type CalendarSliceState = {
  status: CalendarStatus
}

const initialState: CalendarSliceState = {
  status: "idle",
}

export const calendarSlice = createAppSlice({
  name: "calendar",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setStatus: create.reducer(
      (state, action: PayloadAction<CalendarStatus>) => {
        state.status = action.payload
      },
    ),
  }),
  selectors: {
    selectStatus: state => state.status,
  },
})

export const { reset: resetCalendar, setStatus: setCalendarStatus } =
  calendarSlice.actions

export const { selectStatus: selectCalendarStatus } = calendarSlice.selectors
