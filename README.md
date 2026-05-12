# hytta-start

Property-management SPA. React + Vite client, Hono + tRPC server, Postgres via Drizzle ORM.

---

## Tech stack

**Frontend** (`client/`)
- React 19 + TypeScript, bundled with Vite 6
- TanStack Router (file-based, code-split) for routing
- TanStack React Query for server state, paired with `@trpc/tanstack-react-query` for typed hooks (`useTRPC()`, `useSuspenseQuery`, `useMutation`)
- Redux Toolkit + React-Redux for local UI state
- `@digdir/designsystemet-react` (+ matching CSS) for the design system
- Zod v4 for input validation
- Flatpickr for date inputs

**Backend** (`server/`)
- Hono 4 on `@hono/node-server`, with `hono/cors` and `@hono/trpc-server` as the tRPC adapter
- tRPC v11 — routers under `server/src/trpc/routers/`, composed in `_app.ts`
- Drizzle ORM (`drizzle-orm/node-postgres`) talking to Postgres via `pg`
- `tsx watch` for hot reload during development
- `dotenv` for env loading

**Database & infra**
- Postgres 17 (Docker, see `docker-compose.yml`) — primary store
- Drizzle Kit for schema migrations (`drizzle/` directory, generated SQL)

**Tooling**
- TypeScript (project references across `client/` and `server/`)
- ESLint (flat config) + Prettier
- Vitest + Testing Library + jsdom for client tests
- `concurrently` to run web + API together (`npm run dev:all`)

---

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Start Postgres

The database runs in Docker. From the repo root:

```sh
docker compose up -d
```

This starts `postgres:17-alpine` on `localhost:5432` with password `mypassword` and a persistent `pgdata` volume.

Stop it later with `docker compose down` (keeps data) or `docker compose down -v` (wipes data).

### 3. Configure environment

A `.env` already exists at the repo root with:

```
DATABASE_URL=postgres://postgres:mypassword@localhost:5432/postgres
```

This file is read by both the server (`dotenv/config` in `server/src/index.ts`) and `drizzle.config.ts`.

### 4. Run migrations

After any change to `server/src/db/schema/*`, generate and apply the SQL:

```sh
npm run db:generate   # writes new migration files into ./drizzle
npm run db:migrate    # applies them to the running Postgres
```

On a fresh checkout, just run `db:migrate` — the existing migrations in `./drizzle` are already committed.

### 5. Seed (optional)

```sh
npm run db:seed
```

Inserts a demo user (`owner@example.com`) and one property (`Hytta`) if they don't already exist. Idempotent.

### 6. Run the app

```sh
npm run dev:all
```

Starts both processes via `concurrently`:

- **web** (cyan) — Vite dev server on `http://localhost:5173`, proxies `/api` → `http://localhost:3001`
- **api** (magenta) — Hono + tRPC on `http://localhost:3001`, watched by `tsx`

Health check: `http://localhost:3001/health` → `{ "ok": true }`.

To run them separately: `npm run dev` (client) and `npm run dev:server` (api).

### Other useful scripts

| Script | What it does |
| --- | --- |
| `npm run db:studio` | Opens Drizzle Studio to browse the DB in a browser |
| `npm run type-check` | `tsc -b --noEmit` across the workspace |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest |
| `npm run build` | Type-check then build the client |

---

## How a query gets from the DB to the UI

The end-to-end pattern is **Drizzle table → tRPC procedure → tRPC router → `useTRPC()` in component → loader prefetch**. Each layer has one responsibility, and the client never imports server runtime code — only the `AppRouter` *type*.

```
server/src/db/schema/*          ← table definitions (Drizzle)
        ↓
server/src/db/client.ts         ← single `db` instance, exported once
        ↓
server/src/trpc/context.ts      ← injects `db` into every request's ctx
        ↓
server/src/trpc/routers/*.ts    ← procedures (queries + mutations)
        ↓
server/src/trpc/routers/_app.ts ← composes the AppRouter + exports its type
        ↓ (type-only import — `import type { AppRouter }`)
client/src/trpc/client.ts       ← typed proxy bound to `/api/trpc`
        ↓
client/src/features/*/*.tsx     ← components call `useTRPC()` + useSuspenseQuery / useMutation
        ↑
client/src/routes/_authed/*.tsx ← route loader prefetches via `ensureQueryData`
```

### Step-by-step: add a new endpoint

This walks through adding a `property.list` query end-to-end. Follow the same shape for any new resource.

#### 1. Define / extend the table

`server/src/db/schema/property.schema.ts`:

```ts
import { integer, pgTable, varchar } from "drizzle-orm/pg-core"

export const propertyTable = pgTable("properties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
})
```

Then:

```sh
npm run db:generate
npm run db:migrate
```

If the new table needs to be available on `ctx.db.query.<table>`, also re-export it from `server/src/db/client.ts` (the `schema: { ... }` object passed to `drizzle()`).

#### 2. Add a procedure

`server/src/trpc/routers/property.ts` (new file):

```ts
import { asc } from "drizzle-orm"
import { propertyTable } from "../../db/schema/property.schema.ts"
import { publicProcedure, router } from "../init.ts"

export const propertyRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(propertyTable)
      .orderBy(asc(propertyTable.name))
  }),
})
```

Use `protectedProcedure` instead of `publicProcedure` if the call requires an `authorization` header (see `server/src/trpc/init.ts`).

For mutations, validate input with Zod (v4 — use `{ error: "..." }` for custom messages, not `{ message: "..." }`):

```ts
create: protectedProcedure
  .input(z.object({ name: z.string().min(1), address: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db.insert(propertyTable).values(input).returning()
    return created
  }),
```

#### 3. Mount it on the AppRouter

`server/src/trpc/routers/_app.ts`:

```ts
import { router } from "../init.ts"
import { bookingRouter } from "./booking.ts"
import { propertyRouter } from "./property.ts"   // ← add

export const appRouter = router({
  booking: bookingRouter,
  property: propertyRouter,                       // ← add
})

export type AppRouter = typeof appRouter
```

That's the entire server side. The client picks up the new procedure automatically through the `AppRouter` type.

#### 4. Prefetch in the route loader

Prefetch on navigation so the component never sees a loading state. Use `trpc` (the non-hook proxy from `@/trpc/client`), not `useTRPC`:

```tsx
// client/src/routes/_authed/properties.tsx
import { createFileRoute } from "@tanstack/react-router"
import { PropertyList } from "@/features/properties/PropertyList"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/properties")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(trpc.property.list.queryOptions()),
  component: PropertyList,
})
```

#### 5. Use it in the component

Call `useTRPC()` directly in the component — no per-feature wrapper hook. Because the loader already populated the cache, read with `useSuspenseQuery` and skip the loading branch entirely:

```tsx
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"

export function PropertyList() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data } = useSuspenseQuery(trpc.property.list.queryOptions())

  const createProperty = useMutation(
    trpc.property.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
      },
    }),
  )

  return <ul>{data.map(p => <li key={p.id}>{p.name}</li>)}</ul>
}
```

The loader and `useSuspenseQuery` share the same query key, so the hook reads from cache instantly. `useSuspenseQuery` guarantees `data` is non-undefined and doesn't re-suspend on refetches after invalidation.

---

## Conventions to keep this consistent

- **Never import server code from the client.** Only `import type { AppRouter }` crosses the boundary. The `@server` Vite alias resolves at build time but should only ever feed type imports — runtime imports will break the bundle.
- **Always go through `ctx.db`** in procedures, never import `db` directly from `../db/client.ts`. This keeps procedures testable and the connection lifecycle in one place.
- **Call `useTRPC()` directly in components** — no per-feature wrapper hook. Prefer `useSuspenseQuery` when the route loader prefetches the data (eliminates the `isPending` branch); fall back to `useQuery` when there's no loader.
- **Every query used in a component is prefetched in the loader** via `context.queryClient.ensureQueryData(trpc.<router>.<proc>.queryOptions(...))`. This keeps `useSuspenseQuery` from actually suspending on initial render.
- **Mutations invalidate the queries they affect** in `onSuccess`. Use `trpc.<router>.<proc>.queryKey()` to get the right key.
- **Zod v4 error shape**: use `{ error: "..." }` (not `{ message: "..." }`) in `.min()`, `.refine()`, `.regex()`, etc. The bare string short form (`z.string().min(1, "too short")`) also still works.
- **Schema changes always go through `db:generate` + `db:migrate`** — don't hand-edit files in `./drizzle`.
- **Protected vs public**: pick `protectedProcedure` if the call needs an authenticated user (currently checks for an `authorization` header — replace with real verification before shipping).