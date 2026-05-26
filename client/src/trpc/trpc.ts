import { createTRPCContext } from "@trpc/tanstack-react-query"
import type { AppRouter } from "@server/trpc/routers/_app.ts"

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
