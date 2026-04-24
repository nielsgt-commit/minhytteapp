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

export const { reset: resetProperty, setSelectedPropertyId } =
  propertySlice.actions

export const { selectSelectedPropertyId } = propertySlice.selectors