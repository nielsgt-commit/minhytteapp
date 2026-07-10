import { StrictMode } from "react"

import { createRouter, RouterProvider } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
// Import generated route tree.
import { routeTree } from "./routeTree.gen"

import { createRoot } from "react-dom/client"
import { queryClient } from "./app/queryClient"
import { TRPCProvider } from "./trpc/trpc"
import { trpcClient } from "./trpc/client"
import { registerSW } from "virtual:pwa-register"
import i18next from "i18next"
import "@digdir/designsystemet-css/theme"
import "@digdir/designsystemet-css"
import "./i18n"
import "./index.css"
import { toCanonicalPath, toPublicPath } from "./i18n/localizedPaths"

// Only install the service worker for real production builds. In dev the
// SW would cache stale assets and mask hot-reload changes.
if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

// The route tree is Norwegian-canonical; English URLs are aliases handled
// entirely here (see localizedPaths.ts). `input` canonicalizes the browser
// URL before route matching, `output` localizes what the address bar and
// Link hrefs show. Search params (?property=&user=) pass through untouched.
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  rewrite: {
    input: ({ url }) => {
      url.pathname = toCanonicalPath(url.pathname)
      return url
    },
    output: ({ url }) => {
      url.pathname = toPublicPath(
        url.pathname,
        i18next.resolvedLanguage === "en" ? "en" : "nb",
      )
      return url
    },
  },
})

declare module "@tanstack/react-router" {
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
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          <RouterProvider router={router} />
        </TRPCProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file.",
  )
}
