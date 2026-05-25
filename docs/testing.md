# Testing — reachability check

Quick way to verify the full stack is wired up: Vite/React → `@trpc/client` →
Hono → Drizzle → Postgres. Runs one procedure per router and logs the
response so you can eyeball it.

Test file: `client/src/trpc/connectivity.e2e.test.ts`.

This is an **end-to-end test**, separated from the default unit/integration
suite. It runs via its own command (`pnpm test:e2e`) and its own config
(`client/vite.config.e2e.ts`). The default `pnpm test` does *not* include it
and stays hermetic — see [`ci.md`](./ci.md) for how that ties into CI.

## Prereqs

The test hits a real API and a real DB, so both must be running:

```sh
docker compose up -d     # Postgres on :5432
pnpm db:migrate          # only needed on a fresh DB
pnpm dev:server          # Hono + tRPC on :3001
```

Optional: `pnpm db:seed` to get a user (`id=1`) and property (`id=1`) so
`create` mutations using those FKs don't fail.

## Run

```sh
pnpm test:e2e
```

The test pings `/health` in `beforeAll`, then calls each list/summary
procedure through a fresh `createTRPCClient<AppRouter>` pointed at
`http://localhost:3001/api/trpc`. Each response is `console.log`'d.

Override endpoints via env if you need to point at a non-default host:

```sh
VITE_TEST_API_URL=http://api.local/api/trpc \
VITE_TEST_HEALTH_URL=http://api.local/health \
pnpm test:e2e
```

## What the output looks like

On a freshly migrated + seeded DB, empty tables return empty arrays:

```
booking.list      -> []
expense.list      -> []
maintenance.list  -> []
settlement.list   -> []
dashboard.summary -> { expenseCount: 0, totalSpent: 0, upcomingBookings: 0, openMaintenance: 0 }
```

If the server isn't running, `beforeAll` fails with `ECONNREFUSED` — that's
the intended signal that the front end can't reach the back end.

## Why this test is an integration test, not a unit test

The whole point is to prove the boundary works: HTTP, CORS, serialization,
the tRPC router mount, Drizzle's connection pool. Mocking any of those
defeats the purpose. The test uses `@vitest-environment node` (at the top of
the file) so we're not fighting jsdom's fetch/CORS handling, and it imports
the same `AppRouter` type the real client uses — so if a procedure is
renamed or removed, this file stops type-checking.

## Adding a new router to the check

When you add a router in `server/src/trpc/routers/` and mount it on
`_app.ts`, append one `test(...)` block in `connectivity.e2e.test.ts` that
calls its simplest read procedure and asserts the response shape. Keep it
to list or summary queries — mutations belong in their own tests with
setup/teardown.