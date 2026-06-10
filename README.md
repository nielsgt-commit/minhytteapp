# minhytteapp

Property-management SPA. React + Vite client, Hono + tRPC server, Postgres via Drizzle ORM.
**Live on minhytte.app** 

---

## Features

- **Stay planning** — book and plan stays on a shared calendar
- **Priority weeks** — allocate high-demand weeks with conflict resolution
- **Expenses & settlement** — track shared expenses, split by policy, and settle up between owners
- **Maintenance & inspections** — schedule maintenance, track due dates, log inspections
- **Property setup** — manage structures, rooms, equipment, infrastructure, parking, and contacts
- **Members & access** — owners, user groups, ownership shares, and email invitations, scoped per property
- **Dashboard** — overview of upcoming stays, costs, and maintenance
- Installable PWA, internationalized (Norwegian)

---

## Tech stack

**Frontend** (`client/`)

- React 19 + TypeScript, bundled with Vite 6
- TanStack Router (file-based, code-split) for routing
- TanStack React Query for server state, paired with `@trpc/tanstack-react-query` for typed hooks (`useTRPC()`, `useSuspenseQuery`, `useMutation`)
- Redux Toolkit + React-Redux for local UI state
- `@digdir/designsystemet-react` (+ matching CSS) for the design system, with `@navikt/aksel-icons` for icons
- i18next + react-i18next (browser language detection) for internationalization
- PortableText (`@portabletext/editor` + `@portabletext/react`) for rich-text content
- Installable PWA via `vite-plugin-pwa` + `workbox-window`
- Zod v4 for input validation
- Flatpickr for date inputs

**Backend** (`server/`)

- Hono 4 on `@hono/node-server`, with `hono/cors` and `@hono/trpc-server` as the tRPC adapter
- tRPC v11 — routers under `server/src/trpc/routers/`, composed in `_app.ts`
- better-auth for authentication / sessions
- Drizzle ORM (`drizzle-orm/node-postgres`) talking to Postgres via `pg`
- Pino for structured logging
- Resend for transactional email
- `tsx watch` for hot reload during development
- `dotenv` for env loading

**Database & infra**

- Postgres 18 (Docker, see `docker-compose.yml`) — primary store
- Drizzle Kit for schema migrations (`drizzle/` directory, generated SQL)
- Deployed on Render (live at minhytte.app)

**Tooling**

- pnpm (`pnpm@10.30.0`) as the package manager
- TypeScript (project references across `client/` and `server/`)
- ESLint (flat config) + Prettier
- Vitest + Testing Library + jsdom for client tests; separate server + e2e Vitest configs
- `i18next-cli` for locale-key extraction checks
- `concurrently` to run web + API together (`pnpm dev:all`)
