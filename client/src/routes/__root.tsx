import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layouts/AppLayout"

export type AppRouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: () => (
    <AppLayout>
      <Outlet />
      <TanStackRouterDevtools />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </AppLayout>
  ),
})
