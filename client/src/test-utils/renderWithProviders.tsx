import { type ReactElement } from "react"
import {
  act,
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
  type AnyRouter,
} from "@tanstack/react-router"
import { selectionSearchSchema } from "@/selection/searchSchema"
import { TRPCProvider } from "@/trpc/trpc"
import { trpcClient as defaultTrpcClient } from "@/trpc/client"
import i18n from "@/i18n"

export type ProviderOptions = {
  /** Initial URL search params (selection state) for the test router. */
  initialSearch?: { property?: number; user?: number }
  /**
   * @deprecated Redux is gone; selection now lives in the URL. The legacy
   * `property.selectedPropertyId` / `user.selectedUserId` shapes are mapped
   * onto `initialSearch`. Use `initialSearch` instead.
   */
  preloadedState?: {
    property?: { selectedPropertyId?: number | null }
    user?: { selectedUserId?: number | null }
  }
  queryClient?: QueryClient
  trpcClient?: typeof defaultTrpcClient
  seed?: (queryClient: QueryClient) => void
  language?: "en" | "nb"
}

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
}

export type RenderWithProvidersResult = RenderResult & {
  router: AnyRouter
  queryClient: QueryClient
}

export async function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
): Promise<RenderWithProvidersResult> {
  const {
    initialSearch,
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the shim consumes its own deprecated option
    preloadedState,
    queryClient = makeTestQueryClient(),
    trpcClient = defaultTrpcClient,
    seed,
    language = "en",
    ...rtlOptions
  } = options

  if (i18n.language !== language) void i18n.changeLanguage(language)
  if (seed) seed(queryClient)

  const property =
    initialSearch?.property ??
    preloadedState?.property?.selectedPropertyId ??
    undefined
  const user =
    initialSearch?.user ?? preloadedState?.user?.selectedUserId ?? undefined

  const params = new URLSearchParams()
  if (property != null) params.set("property", String(property))
  if (user != null) params.set("user", String(user))
  const search = params.toString()
  const initial = search ? `/?${search}` : "/"

  const rootRoute = createRootRoute({
    validateSearch: selectionSearchSchema,
    component: () => (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {ui}
        </TRPCProvider>
      </QueryClientProvider>
    ),
  })

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initial] }),
  })

  let result!: RenderResult
  await act(async () => {
    // The test router is structurally independent of the app's Register types.
    result = render(<RouterProvider router={router as never} />, rtlOptions)
  })
  return { ...result, router, queryClient }
}
