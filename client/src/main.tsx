import { StrictMode } from "react"

import { createRouter, RouterProvider } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
// Import generated route tree.
import { routeTree } from "./routeTree.gen"


import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { store } from "./app/store"
import { queryClient } from "./app/queryClient"
import { useAppSelector } from "./app/hooks"
import {
  selectIsAuthenticated,
  selectUser,
} from "./features/auth/authSlice"
import { TRPCProvider } from "./trpc/trpc"
import { trpcClient } from "./trpc/client"
import "./index.css"



const router = createRouter({
  routeTree,
  context: {
    auth: { isAuthenticated: false, user: null },
    queryClient,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerApp() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const user = useAppSelector(selectUser)
  return (
    <RouterProvider
      router={router}
      context={{ auth: { isAuthenticated, user }, queryClient }}
    />
  )
}

const container = document.getElementById("root")

if (container) {
  const root = createRoot(container)

  root.render(
    <StrictMode>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <InnerApp />
          </TRPCProvider>
        </QueryClientProvider>
      </Provider>
    </StrictMode>,
  )
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file.",
  )
}