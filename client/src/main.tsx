import { StrictMode } from "react"

import { createRouter, RouterProvider } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
// Import generated route tree.
import { routeTree } from "./routeTree.gen"


import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { store } from "./app/store"
import { queryClient } from "./app/queryClient"
import { TRPCProvider } from "./trpc/trpc"
import { trpcClient } from "./trpc/client"
import "./index.css"


// Until `trpc.auth.me` is wired up, fake an authenticated session in dev so the
// `_authed` route guard doesn't bounce us back to `/`.
const auth = import.meta.env.DEV
  ? { isAuthenticated: true, user: { id: "demo", name: "Demo User" } }
  : { isAuthenticated: false, user: null }

const router = createRouter({
  routeTree,
  context: {
    auth,
    queryClient,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const container = document.getElementById("root")

if (container) {
  const root = createRoot(container)

  root.render(
    <StrictMode>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <RouterProvider router={router} />
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