// A tRPC client whose terminating link answers from an in-memory handler map
// instead of HTTP. Because TRPCProvider builds the useTRPC() options proxy
// from whatever client it is given, a component's real queryOptions /
// mutationOptions / onMutate / onError code runs unmodified against a real
// QueryClient — which is the only way to genuinely exercise optimistic
// caching and rollback in a jsdom test.
//
// No transformer runs on this link, so handlers must return values already
// in OUTPUT shape: real Temporal.PlainDate/Instant instances, not superjson
// wire JSON.

import {
  TRPCClientError,
  createTRPCClient,
  type TRPCLink,
} from "@trpc/client"
import { observable } from "@trpc/server/observable"
import type { AppRouter } from "@server/trpc/routers/_app.ts"

export type FakeHandlers = Record<
  string,
  ((input: unknown) => unknown) | undefined
>

function fakeLink(handlers: FakeHandlers): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable(observer => {
        const handler = handlers[op.path]
        if (!handler) {
          observer.error(
            TRPCClientError.from(
              new Error(`fakeTrpcClient: no handler for "${op.path}"`),
            ),
          )
          return
        }
        Promise.resolve()
          .then(() => handler(op.input))
          .then(data => {
            observer.next({ result: { data } })
            observer.complete()
          })
          .catch((cause: unknown) => {
            observer.error(TRPCClientError.from(cause as Error))
          })
      })
}

/**
 * Handlers are looked up by dot path per call (e.g. "todo.listForProperty"),
 * so a test may swap `handlers["todo.create"]` mid-test — e.g. resolve for
 * the happy path, then reject to exercise the optimistic rollback.
 */
export function createFakeTrpcClient(handlers: FakeHandlers) {
  return createTRPCClient<AppRouter>({ links: [fakeLink(handlers)] })
}
