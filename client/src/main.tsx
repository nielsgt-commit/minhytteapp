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
import "@digdir/designsystemet-css/theme"
import "@digdir/designsystemet-css"
import "./i18n"
import "./index.css"


const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
})

declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
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
