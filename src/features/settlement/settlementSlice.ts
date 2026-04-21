import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type SettlementStatus = "idle" | "loading" | "failed"

export type SettlementSliceState = {
  status: SettlementStatus
}

const initialState: SettlementSliceState = {
  status: "idle",
}

export const settlementSlice = createAppSlice({
  name: "settlement",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setStatus: create.reducer(
      (state, action: PayloadAction<SettlementStatus>) => {
        state.status = action.payload
      },
    ),
  }),
  selectors: {
    selectStatus: state => state.status,
  },
})

export const { reset: resetSettlement, setStatus: setSettlementStatus } =
  settlementSlice.actions

export const { selectStatus: selectSettlementStatus } =
  settlementSlice.selectors
