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

// Action creators/selectors remain only so the store keeps compiling until
// the Redux teardown wave; the URL search params are now authoritative.
export const { reset: resetUser, setSelectedUserId } = userSlice.actions

export const { selectSelectedUserId } = userSlice.selectors

// The selected user id now lives in the URL (?user=). Re-exported here so
// existing readers keep working until imports are migrated.
export { useSelectedUserId } from "@/selection/useSelection"
