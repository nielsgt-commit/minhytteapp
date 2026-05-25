import { type ReactElement, type ReactNode } from "react"
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react"
import { Provider } from "react-redux"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { makeStore, type AppStore, type RootState } from "@/app/store"
import { TRPCProvider } from "@/trpc/trpc"
import { trpcClient as defaultTrpcClient } from "@/trpc/client"
import i18n from "@/i18n"

export type ProviderOptions = {
  preloadedState?: Partial<RootState>
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
  store: AppStore
  queryClient: QueryClient
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderWithProvidersResult {
  const {
    preloadedState,
    queryClient = makeTestQueryClient(),
    trpcClient = defaultTrpcClient,
    seed,
    language = "en",
    ...rtlOptions
  } = options

  const store = makeStore(preloadedState)

  if (i18n.language !== language) void i18n.changeLanguage(language)
  if (seed) seed(queryClient)

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            {children}
          </TRPCProvider>
        </QueryClientProvider>
      </Provider>
    )
  }

  const result = render(ui, { wrapper: Wrapper, ...rtlOptions })
  return { ...result, store, queryClient }
}
