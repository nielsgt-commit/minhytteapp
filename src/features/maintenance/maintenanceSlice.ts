import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type MaintenanceStatus = "idle" | "loading" | "failed"

export type MaintenanceSliceState = {
  status: MaintenanceStatus
}

const initialState: MaintenanceSliceState = {
  status: "idle",
}

export const maintenanceSlice = createAppSlice({
  name: "maintenance",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setStatus: create.reducer(
      (state, action: PayloadAction<MaintenanceStatus>) => {
        state.status = action.payload
      },
    ),
  }),
  selectors: {
    selectStatus: state => state.status,
  },
})

export const { reset: resetMaintenance, setStatus: setMaintenanceStatus } =
  maintenanceSlice.actions

export const { selectStatus: selectMaintenanceStatus } =
  maintenanceSlice.selectors