import type { PayloadAction } from "@reduxjs/toolkit"
import { createAppSlice } from "@/app/createAppSlice"

export type AuthUser = {
  id: string
  name: string
}

export type AuthStatus = "idle" | "loading" | "failed"

export type AuthSliceState = {
  user: AuthUser | null
  status: AuthStatus
}

const initialState: AuthSliceState = {
  user: { id: "demo", name: "Demo User" },
  status: "idle",
}

export const authSlice = createAppSlice({
  name: "auth",
  initialState,
  reducers: create => ({
    login: create.reducer((state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload
      state.status = "idle"
    }),
    logout: create.reducer(state => {
      state.user = null
      state.status = "idle"
    }),
    setStatus: create.reducer((state, action: PayloadAction<AuthStatus>) => {
      state.status = action.payload
    }),
  }),
  selectors: {
    selectUser: state => state.user,
    selectIsAuthenticated: state => state.user !== null,
    selectAuthStatus: state => state.status,
  },
})

export const { login, logout, setStatus: setAuthStatus } = authSlice.actions

export const { selectUser, selectIsAuthenticated, selectAuthStatus } =
  authSlice.selectors

export type AuthRouterContext = {
  isAuthenticated: boolean
  user: AuthUser | null
}
