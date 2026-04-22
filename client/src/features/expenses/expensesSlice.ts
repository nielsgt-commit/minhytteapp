import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type ExpensesStatus = "idle" | "loading" | "failed"

export type ExpensesSliceState = {
  status: ExpensesStatus
}

const initialState: ExpensesSliceState = {
  status: "idle",
}

export const expensesSlice = createAppSlice({
  name: "expenses",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setStatus: create.reducer((state, action: PayloadAction<ExpensesStatus>) => {
      state.status = action.payload
    }),
  }),
  selectors: {
    selectStatus: state => state.status,
  },
})

export const { reset: resetExpenses, setStatus: setExpensesStatus } =
  expensesSlice.actions

export const { selectStatus: selectExpensesStatus } = expensesSlice.selectors
