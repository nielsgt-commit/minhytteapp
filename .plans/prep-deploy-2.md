# Deploy prep — plan

> Render specifics verified via Context7 against `/websites/render` (official Render docs). Target: Render Starter subscription with managed Postgres, GitHub-driven builds.
>
> **Environments: development (local) and production only.** Staging is out of scope for now.

## Where the project already is

- Env files: `.env.example`, `.env.development` (committed), `.env.production` (template — real values in Render). `.env.staging` exists from earlier planning but is unused going forward — can be deleted.
- `server/src/env.ts` and `drizzle.config.ts` both load `.env.${NODE_ENV}` via `dotenv`.
- `docker-compose.yml` runs local Postgres only.
- ~56 Drizzle migrations checked in.
- `better-auth` with magic-link plugin; magic links currently `console.log`ed in dev and `throw`n in production.
- CI: `.github/workflows/test.yml` exists (pnpm install + `pnpm test`). Missing lint, type-check, build, and a Postgres-backed integration job.
- `render.yaml` exists but is an unmodified Django sample — needs rewriting.

## Critical gaps that block a real deploy

1. **No production server build/start path.** ✅ Done — `start: tsx server/src/index.ts`, `tsx` moved to `dependencies`.
2. **`Dockerfile` is a non-functional stub** (`ubuntu:latest` + `top -b`). Delete it — Render's Node buildpack is what we use.
3. **CI is minimal.** Needs lint + type-check + build + an integration job that spins up Postgres and runs `connectivity.e2e.test.ts`.
4. **Drizzle migrations have no production runner.** Use Render's Pre-Deploy Command set to `pnpm db:migrate`. Pre-deploy runs on a separate instance; filesystem changes don't carry over to runtime. Fine for migrations.
5. **SSL on `pg` Pool**: not needed when using Render's _internal_ Postgres URL (private network, same region). Only external connections (CI, local Studio against prod) need it via `?sslmode=require` in the URL.
6. **Server bind host.** Render requires `0.0.0.0`. `@hono/node-server`'s `serve()` defaults to that, but worth confirming and/or setting `HOST=0.0.0.0` explicitly.
7. **`pnpm build` currently fails** — pre-existing blockers (i18n typing in `PriorityWeeks.tsx`, Mock typing in new test files, possibly missing `workbox-window`). Must be green before Render can deploy.

## Environment & config hygiene

8. **`.env.development` is committed with a real `BETTER_AUTH_SECRET`.** Rotate and document that dev secrets are placeholders. Local overrides should live in `.env.development.local`.
9. **Drizzle config requires `NODE_ENV` to load the right file.** On Render the env is injected directly — `dotenv` will silently find nothing. Make the dotenv call no-op when running on Render (e.g., gate on `process.env.RENDER`), so missing vars fail loudly.
10. **`BETTER_AUTH_URL` semantics.** Single-origin per env: in dev it's the client (`localhost:5173`); in prod it's `https://minhytte.app`. better-auth, CORS, and `trustedOrigins` all share that one origin.
11. **`process.env.CORS_ORIGIN` is a single string.** If we ever need `minhytte.app` + `www.minhytte.app`, split into a comma list.

## Auth & request-path hardening

12. **Magic-link transport via Resend.** Production `throw`s today. Wire `sendMagicLink` in `server/src/auth/auth.ts` to call the Resend SDK; add `resend` to deps, `RESEND_API_KEY` + `MAGIC_LINK_FROM` to env contract. Verified sending domain on `minhytte.app` (SPF + DKIM DNS).
13. **`devRouter.wipe` gating.** Currently `NODE_ENV !== "production"` — fine now that we only have dev + prod. Tighten to `=== "development"` anyway for symmetry, and consider unmounting the whole `dev` router outside dev.
14. **Rate limit `/api/auth/*`** (better-auth has built-in options) so magic-link issuance isn't spammable.
15. **Security headers**: add `hono/secure-headers` (CSP, X-Frame-Options, Referrer-Policy). CSP needs to allow the PWA + connect-src for the same origin.
16. **Trust proxy / forwarded headers.** Behind Render's load balancer, ensure `sessionsTable.ip_address` records the real client IP via `x-forwarded-for`.
17. **Cookies stay simple** in the single-origin topology: `SameSite=Lax`, `Secure`, no `domain=` needed.

## Deployment topology on Render — DECIDED

Single Hono Web Service per env. It serves both `/api/*` and the built `client/dist`. No CORS, no cross-subdomain cookies, one `BETTER_AUTH_URL` per env, relative `/api/trpc` works as-is.

### Implications

- ✅ `hono/serve-static` mounted in `server/src/index.ts` with SPA fallback, gated to `NODE_ENV === "production"`.
- Custom domain: `minhytte.app` (prod). One DNS record.
- Build: `tsc -b && vite build client` (existing); Start: `tsx server/src/index.ts`.

### Render Blueprint (`render.yaml`)

One project, **one environment (`production`)**, one Web Service + one Postgres + one env var group.

- Auto-wire `DATABASE_URL` via `fromDatabase`.
- `BETTER_AUTH_SECRET` via `generateValue: true` (Render generates once).
- Secrets like `RESEND_API_KEY` declared with `sync: false` (set in dashboard, not in YAML).
- `pnpm db:migrate` as the Pre-Deploy Command.

## Frontend production behavior

18. **PWA service worker `registerSW({ immediate: true })`** is unconditional. Gate behind `import.meta.env.PROD` so dev browsers don't cache anything.
19. **API base URL stays relative** (`httpBatchLink({ url: "/api/trpc" })`) — same-origin, no `VITE_API_URL` needed.
20. **Error boundaries / Sentry-equivalent**: worth adding for production. Server-side: Sentry or structured `pino` logs piped to Render's log drain.

## Observability & ops

21. `/health` returns static `{ ok: true }` — doesn't verify DB. Add a `/ready` that does a `SELECT 1` so Render's health check catches DB outages.
22. No structured logging. Replace `console.error` with `pino`; add `hono/logger` for requests.
23. No graceful shutdown — `pg` pool isn't drained on SIGTERM. Render restarts will sometimes orphan connections.

## Dead code worth cleaning before deploy

- `server/src/backend.ts` + `server/src/db.ts` — in-memory mock, looks unused now. Confirm and delete.
- `Dockerfile` stub — delete.
- `.env.staging` — delete (out of scope).

## CI/CD shape

- **PR check** (`.github/workflows/test.yml` exists; extend): pnpm install → `lint` + `format:check` + `type-check` + `test` + `build`. Add a second job with a Postgres service container that runs `db:migrate` and exercises `connectivity.e2e.test.ts`.
- **Deploy**: push to `master` → Render auto-deploys production. Pre-Deploy Command runs `pnpm db:migrate`.
- **Branch strategy**: trunk-based on `master`. Without staging, prod is the only deploy target.

## Suggested order

1. **Hono serves the SPA** ✅ done.
2. **Build + start scripts** ✅ done.
3. **Fix `pnpm build`** ✅ done (67 → 0 TS errors: i18n `nsSeparator` collision fixed, workbox-window added, Heading `data-size` API, recurrence enum widened, mock test typing, useParking ctx, ES2021 lib bump).
4. **`render.yaml` Blueprint** ✅ done. Single Web Service + Starter Postgres in Frankfurt, auto-deploy from master, `pnpm db:migrate` as Pre-Deploy, health check at `/health`. Shared non-secret env lives in the `minhytteapp` env var group (referenced via `fromGroup`); the service adds `DATABASE_URL` (`fromDatabase`), `BETTER_AUTH_SECRET` (`generateValue: true`), and `RESEND_API_KEY` (`sync: false`, set manually in the dashboard — can't live in a group).
5. **Delete `Dockerfile` stub and `.env.staging`** ✅ done.
6. **Env loading** ✅ done. `server/src/env.ts` and `drizzle.config.ts` now skip `dotenv.config()` when `process.env.RENDER` is set, so missing vars on Render fail loudly instead of being masked by the committed `.env.production` template's empty values.
7. **`devRouter.wipe` gating + rotate dev secret** ✅ done. `isDev` in `server/src/trpc/routers/dev.ts` is now `=== "development"`. Rotated `BETTER_AUTH_SECRET` in `.env.development` and added a comment marking it as a local-only placeholder.
8. **Magic-link via Resend** + rate-limit `/api/auth/*` ✅ done. `sendMagicLink` calls Resend with `from = MAGIC_LINK_FROM`; throws if either env var is missing. better-auth `rateLimit` enabled with `/sign-in/magic-link` capped at 5 requests/minute. `RESEND_API_KEY` + `MAGIC_LINK_FROM` declared in `.env.example` and `.env.production`.
9. **Extend CI workflow** ✅ done (partial). `.github/workflows/test.yml` now has two jobs: `checks` (format:check, type-check, test, build) and `e2e` (Postgres service container → db:migrate → start API → wait for /health → `pnpm test:e2e`). Also ran `pnpm format` across the repo (rewrote ~984 files cosmetically), fixed the broken `paths-ignore` pattern (was `../../.plans/**`), and added a `.prettierignore` covering `client/src/routeTree.gen.ts` + lockfile + build output. **Lint deferred** — 462 accumulated ESLint errors (mostly `@typescript-eslint/no-unnecessary-condition`); TODO comment in the workflow marks where to re-enable. See follow-up #14 below.
10. **Hardening** ✅ done (partial). `hono/secure-headers` mounted first (defaults: X-Frame-Options, Referrer-Policy, X-Content-Type-Options, HSTS, COOP, CORP, etc. — CSP intentionally not configured, deferred). Added `/ready` endpoint that runs `SELECT 1` via the `pg` Pool and returns 503 on failure; `render.yaml` now points `healthCheckPath: /ready`. Graceful shutdown wired: SIGTERM and SIGINT both stop accepting new connections, drain the pool, and exit, with a 10s hard-exit safety net. **Structured logging deferred** — see follow-up #15 below.
11. **Observability** (Sentry or equivalent) — deferred. Revisit once real traffic exists and we feel pain.
12. **PWA cache gating** ✅ done. `registerSW({ immediate: true })` in `client/src/main.tsx` is now wrapped in `if (import.meta.env.PROD)`, so dev never installs a service worker.
13. **Delete dead code** ✅ done. `server/src/backend.ts` (in-memory CRUD wrapper) and `server/src/db.ts` (hardcoded mock data) confirmed unimported and deleted. The real DB lives at `server/src/db/client.ts`.
14. **Lint debt cleanup** ✅ done. 462 → 0 errors via: (a) ignoring `.claude/worktrees/` in `eslint.config.js` (109 worktree double-counts), (b) `pnpm lint --fix` (106 auto-fixable), (c) a `tests-relaxed` override block in `eslint.config.js` that disables noisy strict rules for `*.test.{ts,tsx}` (143 stub-callback / loose-mock false positives), (d) mechanical fixes across ~30 source files (drizzle destructure `[x]` → `.at(0)`, aksel-icon `asIcon` cast helper, removing redundant `me?.id` after `useSuspenseQuery`, type-predicate on `isDraftSubmittable`, explicit `TRPCError` throws in `inspection.ts` where non-null assertions previously hid bugs). Also fixed a real `react-hooks/rules-of-hooks` bug in `MaintenanceTodos.tsx` (useState was called after an early return). `pnpm lint` re-enabled in the CI workflow. Three `react-hooks/exhaustive-deps` _warnings_ remain (don't fail CI). One inline `eslint-disable-next-line` in `MaintenanceInstructionsPTEditor.tsx` for a `no-deprecated` whose `@deprecated` JSDoc was on union members we don't use.
15. **Structured logging** (deferred). Add `pino` (or small `console.*` JSON wrapper) + `hono/logger`. Skipped for now — `console.error` is good enough for a small user base; revisit if/when we want to grep Render's log drain at scale.
16. **CSP** (deferred). Recommended approach: ship report-only mode first with `script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; worker-src 'self' blob:`. Refactoring app-code inline styles to CSS modules was considered and decided against — the win is bounded by designsystemet/dynamic-width cases that need `'unsafe-inline'` anyway. Real protection comes from strict `script-src 'self'`, which Vite supports out of the box.
17. **Trust proxy / x-forwarded-for** ✅ done. better-auth already defaults to reading `x-forwarded-for` (verified by reading `node_modules/.../utils/get-request-ip.mjs`). Added explicit `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]` in `server/src/auth/auth.ts` to document the choice and pin the behavior against any future default change. This feeds `sessionsTable.ip_address` and the built-in rate limiter; both now see the real client IP behind Render's LB instead of the internal LB address.

## Open questions to confirm in Render UI

- Exact Starter Postgres connection limit and storage cap.
- Whether Web Service Starter ($7/mo) RAM/CPU is enough for our workload.
- Enable point-in-time recovery on Postgres (recommended — available on all paid databases).

## Pre-flight before applying the Blueprint

- Confirm git repo URL in `render.yaml` matches the actual remote.
- Verify `minhytte.app` as a sending domain in Resend (SPF + DKIM DNS records on the apex).
- Have `RESEND_API_KEY` ready to paste into the Render dashboard. (`BETTER_AUTH_SECRET` is auto-generated by Render — no need to prepare a value.)
- Plan to add DNS records at the domain registrar once Render gives you the targets (after Blueprint applies).
- The auth code still `throw`s in production for magic links — Resend wiring (item #8) is in place, but needs `RESEND_API_KEY` set before any real user can log in.

### Env var ownership model

The Blueprint is structural-only — it declares contracts, not values:

- **Auto-wired by Render**: `DATABASE_URL` (`fromDatabase`).
- **Auto-generated by Render**: `BETTER_AUTH_SECRET` (`generateValue: true`) — set once on first apply, never appears in git or the dashboard input.
- **Dashboard, on the service** (sync:false in Blueprint, value set manually): `RESEND_API_KEY`.
- **Dashboard, in the `minhytteapp` env var group** (referenced via `fromGroup`): `NODE_ENV`, `HOST`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `MAGIC_LINK_FROM`, `MET_USER_AGENT`.
- **Auto-injected by Render** (do NOT set manually): `PORT`, `RENDER`, `RENDER_*`.

## First deploy checklist

Step by step. Each step assumes the previous one succeeded.

### 1. Create the `minhytteapp` env var group in the Render dashboard

The Blueprint references this group via `fromGroup: minhytteapp` but doesn't define it — Render needs the group to exist before the Blueprint can apply.

- Render Dashboard → Env Groups → Create Group → name it `minhytteapp`.
- Add the six non-secret config keys:
  ```
  NODE_ENV         = production
  HOST             = 0.0.0.0
  BETTER_AUTH_URL  = https://minhytte.app
  CORS_ORIGIN      = https://minhytte.app
  MAGIC_LINK_FROM  = auth@epost.minhytte.app
  MET_USER_AGENT   = minhytteapp/1.0 weather@minhytte.app
  ```
- Do NOT add `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `PORT`, or `RESEND_SENDER_ID` to this group — they're either auto-wired, set on the service, or unused.

### 2. Apply the Blueprint

- Render Dashboard → Blueprints → New Blueprint Instance → point at the GitHub repo.
- Render reads `render.yaml` and creates:
  - the `minhytteapp` Web Service,
  - the `minhytteapp_production` Postgres database (auto-wires `DATABASE_URL`),
  - the link between the service and the existing `minhytteapp` env var group.
- Render auto-generates `BETTER_AUTH_SECRET` on first apply and persists it on the service. No prompt, no action needed.
- Render prompts for the one `sync:false` secret — paste it now:
  - `RESEND_API_KEY` (from your Resend dashboard).
- If you skip the prompt, the service still boots, but magic-link sends will throw at runtime until `RESEND_API_KEY` is set.

### 3. Validate migrations against the empty Postgres (optional but recommended)

The Blueprint's Pre-Deploy Command will run `pnpm db:migrate` on every deploy. Worth running it once manually against the external URL first so you find out about any breakage with the DB still empty:

- Render Dashboard → `minhytteapp-db` → Connect → copy the **External Database URL** (with `?sslmode=require`).
- Locally:
  ```pwsh
  $env:DATABASE_URL = "<external-url>"
  $env:NODE_ENV = "production"
  pnpm db:migrate
  ```
- Expect: all 55 migrations apply in order, `__drizzle_migrations` table gets populated.
- If anything fails: fix forward (the DB is empty — no risk in tearing it down and starting again from the dashboard).

### 4. Confirm the deploy

- Render Dashboard → `minhytteapp` Web Service → Logs.
- The Pre-Deploy Command should run `pnpm db:migrate` (idempotent — if you did step 3, it's a no-op).
- After Pre-Deploy succeeds the Web Service boots; look for `API listening on http://localhost:10000` (Render maps the public port for you).
- Render's health check hits `/ready` every interval. First success → service goes Live.

### 5. Add the custom domain

- Render Dashboard → `minhytteapp` Web Service → Settings → Custom Domains → `minhytte.app` is already declared in the Blueprint.
- Render shows you the DNS records to add at your registrar (typically an `ANAME`/`ALIAS` or `A` record).
- Wait for TLS provisioning (a minute or two).

### 6. First end-to-end test

- Visit `https://minhytte.app`.
- Sign in via magic link → email lands from `auth@epost.minhytte.app` via Resend → click link → land back signed in.
- Check `sessionsTable.ip_address` in Drizzle Studio (or via `query_render_postgres` MCP tool); should be your real client IP, not `10.x.x.x` Render LB internal.
- Check `/health` and `/ready` from a browser: both return 200, `/ready` confirms DB is reachable.

### 7. (Optional) Seed or import data

- **Empty start**: do nothing. Data accumulates as users sign in.
- **Run a seed script**: against the external URL.
  ```pwsh
  $env:DATABASE_URL = "<external-url>"
  pnpm db:seed       # or pnpm db:seed:minimal
  ```
- **Import from local Docker Postgres**:
  ```pwsh
  # Dump local data only (schema is already on Render)
  pg_dump -h localhost -U postgres -d postgres --data-only --exclude-table=__drizzle_migrations > dump.sql
  # Restore
  psql "<external-url>" -f dump.sql
  ```

### 8. Validate graceful shutdown (passive)

- Push any trivial commit to `master` to trigger a redeploy.
- In the previous instance's logs, look for `[shutdown] received SIGTERM, draining` → `pool drained, exiting`.
- Confirms the SIGTERM handler in `server/src/index.ts` is wired up correctly.

### Rollback if it goes wrong

- Render keeps previous successful deploys for one-click rollback (Dashboard → Deploys → Rollback).
- If a bad migration shipped: write a new migration that reverses or fixes the damage, commit, push. Migrations are forward-only — there are no auto-generated down migrations.
- If the DB itself is corrupted and Postgres point-in-time recovery is enabled (recommended at setup), use it from the dashboard.
