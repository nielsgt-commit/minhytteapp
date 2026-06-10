import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type PropertySliceState = {
  selectedPropertyId: number | null
}

const initialState: PropertySliceState = {
  selectedPropertyId: null,
}

export const propertySlice = createAppSlice({
  name: "property",
  initialState,
  reducers: create => ({
    reset: create.reducer(() => initialState),
    setSelectedPropertyId: create.reducer(
      (state, action: PayloadAction<number | null>) => {
        state.selectedPropertyId = action.payload
      },
    ),
  }),
  selectors: {
    selectSelectedPropertyId: state => state.selectedPropertyId,
  },
})

// Action creators/selectors remain only so the store keeps compiling until
// the Redux teardown wave; the URL search params are now authoritative.
export const { reset: resetProperty, setSelectedPropertyId } =
  propertySlice.actions

export const { selectSelectedPropertyId } = propertySlice.selectors

// The selected property id now lives in the URL (?property=). Re-exported
// here so existing readers keep working until imports are migrated.
export { useSelectedPropertyId } from "@/selection/useSelection"
