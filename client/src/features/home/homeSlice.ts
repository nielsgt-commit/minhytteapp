import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type HomeStatus = "idle" | "loading" | "failed"

export type HomeSliceState = {
  status: HomeStatus
}

const initialState: HomeSliceState = {
  status: "idle",
}

export const homeSlice = createAppSlice({
  name: "home",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setStatus: create.reducer((state, action: PayloadAction<HomeStatus>) => {
      state.status = action.payload
    }),
  }),
  selectors: {
    selectStatus: state => state.status,
  },
})

export const { reset: resetHome, setStatus: setHomeStatus } = homeSlice.actions

export const { selectStatus: selectHomeStatus } = homeSlice.selectors
