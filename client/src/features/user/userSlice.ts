import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type UserSliceState = {
  /** Current "acting as" identity chosen in the header user menu; used as booker/actor id for bookings, maintenance actions, and to scope property/group queries. */
  selectedUserId: number | null
}

const initialState: UserSliceState = {
  selectedUserId: null,
}

export const userSlice = createAppSlice({
  name: "user",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setSelectedUserId: create.reducer(
      (state, action: PayloadAction<number | null>) => {
        state.selectedUserId = action.payload
      },
    ),
  }),
  selectors: {
    selectSelectedUserId: state => state.selectedUserId,
  },
})

export const { reset: resetUser, setSelectedUserId } = userSlice.actions

export const { selectSelectedUserId } = userSlice.selectors