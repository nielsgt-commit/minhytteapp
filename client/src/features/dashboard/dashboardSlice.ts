 import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type DashboardStatus = "idle" | "loading" | "failed"

export type DashboardSliceState = {
  status: DashboardStatus
}

const initialState: DashboardSliceState = {
  status: "idle",
}

export const dashboardSlice = createAppSlice({
  name: "dashboard",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setStatus: create.reducer((state, action: PayloadAction<DashboardStatus>) => {
      state.status = action.payload
    }),
  }),
  selectors: {
    selectStatus: state => state.status,
  },
})

export const { reset: resetDashboard, setStatus: setDashboardStatus } =
  dashboardSlice.actions

export const { selectStatus: selectDashboardStatus } = dashboardSlice.selectors
