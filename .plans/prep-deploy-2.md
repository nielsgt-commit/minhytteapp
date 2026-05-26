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
5. **SSL on `pg` Pool**: not needed when using Render's *internal* Postgres URL (private network, same region). Only external connections (CI, local Studio against prod) need it via `?sslmode=require` in the URL.
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
4. **`render.yaml` Blueprint** ✅ done. Single Web Service + Starter Postgres in Frankfurt, auto-deploy from master, `pnpm db:migrate` as Pre-Deploy, health check at `/health`, env vars wired (`fromDatabase` for DATABASE_URL, `generateValue` for BETTER_AUTH_SECRET, `sync: false` for RESEND_API_KEY).
5. **Delete `Dockerfile` stub and `.env.staging`** — both unused.
6. **Env loading**: make `dotenv` a no-op when running on Render.
7. **Tighten `devRouter.wipe` gating** (`=== "development"`) + rotate the committed dev `BETTER_AUTH_SECRET`.
8. **Magic-link via Resend** + rate-limit `/api/auth/*`.
9. **Extend CI workflow** — add lint, type-check, build, and the Postgres integration job.
10. **Hardening**: `hono/secure-headers`, structured logging, `/ready` endpoint, graceful shutdown.
11. **Observability** (Sentry or equivalent).
12. **PWA cache gating** behind `import.meta.env.PROD`.
13. **Delete dead code**: `server/src/backend.ts` + `server/src/db.ts` if confirmed unused.

## Open questions to confirm in Render UI

- Exact Starter Postgres connection limit and storage cap.
- Whether Web Service Starter ($7/mo) RAM/CPU is enough for our workload.
- Enable point-in-time recovery on Postgres (recommended — available on all paid databases).

## Pre-flight before applying the Blueprint

- Confirm git repo URL in `render.yaml` matches the actual remote.
- Verify `minhytte.app` as a sending domain in Resend (SPF + DKIM DNS records on the apex).
- Have `RESEND_API_KEY` ready to paste into the Render dashboard after first apply (Blueprint marks it `sync: false`).
- Plan to add DNS records at the domain registrar once Render gives you the targets (after Blueprint applies).
- The auth code still `throw`s in production for magic links — order item #8 (Resend wiring) must land before any real user can log in.
