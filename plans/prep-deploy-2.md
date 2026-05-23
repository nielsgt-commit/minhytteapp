# Deploy prep — plan

> Render specifics verified via Context7 against `/websites/render` (official Render docs). Target: Render Starter subscription with managed Postgres, GitHub-driven builds.

## Where the project already is

- Env files exist (`.env.example`, `.env.development`, `.env.staging`, `.env.production`) with the staging/production files documented as Render-managed templates.
- `server/src/env.ts` and `drizzle.config.ts` both load `.env.${NODE_ENV}` via `dotenv`.
- `docker-compose.yml` runs local Postgres only.
- 56 Drizzle migrations checked in.
- `better-auth` with magic-link plugin; magic links currently `console.log`ed in dev/staging and `throw`n in production.

## Critical gaps that block a real deploy

1. **No production server build/start path.** `package.json` has `dev:server` (tsx watch) but no `build:server` and no `start`. Render (or anything) has nothing to run. Options: ship `tsx server/src/index.ts` as the start command (simple, works), or add a real build step with `tsc` / `esbuild` / `tsup` and run plain Node.
2. **`Dockerfile` is a non-functional stub** (`ubuntu:latest` + `top -b`). Either delete it (if Render runs from buildpacks) or replace it with a real multi-stage build (install → build client + server → runtime with `node:22-alpine`, `NODE_ENV=production`, non-root user, copy `drizzle/`).
3. **No CI.** `.github/workflows/` doesn't exist. Need at minimum: install → `lint` → `type-check` → `test` → `build` on PRs, plus a deploy-on-merge path per environment.
4. **Drizzle migrations have no production runner.** `db:migrate` is a dev command. Render supports a Pre-Deploy Command (purpose-built for migrations per Render docs). Set it to `pnpm db:migrate`. Caveat: pre-deploy runs on a separate instance — its filesystem changes don't carry over to runtime. Fine for our case (migrations only touch the DB).
5. **`server/src/db/client.ts` has no SSL config.** Not actually a problem when connecting via Render's *internal* Postgres URL (private network, same region). Only needed for external connections (CI, local Studio against prod) and then it's handled by appending `?sslmode=require` to the URL — not pool config. Action: just make sure prod's `DATABASE_URL` is the internal URL.
6. **Server bind host.** Render requires services to bind on `0.0.0.0`. `@hono/node-server`'s `serve()` defaults to that, but worth a one-line verification and/or setting `HOST=0.0.0.0` explicitly.

## Environment & config hygiene

7. **`.env.development` is committed with a real `BETTER_AUTH_SECRET`.** Even if it's only dev, rotate it and document that dev secrets are placeholders. Local overrides should live in `.env.development.local`.
8. **Drizzle config requires `NODE_ENV` to load the right file.** On Render the env is injected directly — `dotenv` will silently find nothing. Make the dotenv call no-op when running in a managed environment (e.g., only load file when `process.env.RENDER` is unset), so it doesn't mask missing vars.
9. **`BETTER_AUTH_URL` semantics.** In dev it's the client (`localhost:5173`); in prod it's also the client (`https://minhytte.app`). better-auth expects the base URL of the auth endpoints — confirm this matches your topology (same-origin vs separate `api.` subdomain) and align CORS, cookie domain, and `trustedOrigins` accordingly.
10. **Server reads `process.env.CORS_ORIGIN` as a single string.** If you ever need to allow `minhytte.app` + `www.minhytte.app` + a preview URL, split into a comma list and parse it.

## Auth & request-path hardening

10. **Magic-link transport is unimplemented.** Production `throw`s. Need a real sender (Resend / Postmark / SES) wired in, with the API key in Render env. Staging should also use a real sender (or a sandbox address) — not console.log — to actually exercise the path.
11. **`devRouter.wipe` is gated only by `NODE_ENV !== "production"`.** Staging (`NODE_ENV=staging`) will allow it. Either tighten to `=== "development"`, or unmount the entire `dev` router on the AppRouter outside dev.
12. **No rate limiting** on auth or tRPC. At minimum protect `/api/auth/*` (magic-link issuance is spam-able). Hono has middleware for this; or use better-auth's built-in rate-limit options.
13. **No security headers.** Add `hono/secure-headers` (CSP, X-Frame-Options, Referrer-Policy). CSP needs to allow the PWA + connect-src for the API origin.
14. **Trust proxy / forwarded headers.** Behind Render's load balancer, you'll want correct client IPs in `sessionsTable.ip_address` — verify better-auth and Hono read `x-forwarded-for` correctly.
15. **Cookie scope.** If you split to `api.minhytte.app`, session cookies must be set with `domain=.minhytte.app` and `SameSite=Lax`/`None` + `Secure`. Same-origin (everything on `minhytte.app`) avoids this entirely — worth deciding now.

## Deployment topology on Render

Open question — drives a lot of the auth/CORS/cookie work:

- **Single Web Service per env**: Hono serves both `/api/*` and the built client static files. Simplest, no CORS, no cross-domain cookies. On Starter ($7/mo Web Service) this is one service per env = $14/mo for staging + prod, plus Postgres.
- **Static Site + Web Service per env**: Free Static Sites on Render (CDN, free SSL) for `client/dist`, plus a Web Service for the API on `api.<env>.minhytte.app`. Cleaner separation, but requires CORS and cross-subdomain cookies done right.

The current Vite dev proxy and `CORS_ORIGIN` setup suggests two-service thinking; the single-domain `BETTER_AUTH_URL`/`CORS_ORIGIN` values suggest single-service. Worth resolving explicitly.

### Render Blueprint (`render.yaml`)

Use Render's Blueprint format to declare everything as code rather than clicking the dashboard:

- One project, two environments (`staging`, `production`).
- Per env: a Web Service + a Postgres database + an env var group.
- Auto-wire `DATABASE_URL` via `fromDatabase`, generate `BETTER_AUTH_SECRET` per env via `generateValue: true`, and use `fromGroup` for shared keys like `MET_USER_AGENT`.

Benefits: PR previews stay consistent with staging, cloning the project to a new region is trivial, and the file lives in git so we can review env topology changes.

## Frontend production behavior

16. **PWA service worker `registerSW({ immediate: true })`** is unconditional. If you flip between staging/prod URLs on the same browser, you'll get stale caches. Either gate registration behind `import.meta.env.PROD`, or include the environment in the SW scope/cache name.
17. **Client has no notion of API base URL.** `httpBatchLink({ url: "/api/trpc" })` only works if same-origin. If you go two-service, you need `import.meta.env.VITE_API_URL` and matching `.env` files in `client/`.
18. **No error boundary / Sentry-equivalent.** Worth adding for production. Same for the server (Sentry, Highlight, or just structured `pino` logs piped to Render's log drain).

## Observability & ops

19. `/health` returns static `{ ok: true }` — doesn't verify DB. Add a `/ready` that does a `SELECT 1` so Render's health check actually catches DB outages.
20. No structured logging. `console.error(err)` in `app.onError` won't be searchable. Replace with `pino` (or similar) and use `hono/logger` for requests.
21. No graceful shutdown — `pg` pool isn't drained on SIGTERM. Render restarts will sometimes orphan connections.

## Dead code worth cleaning before deploy

- `server/src/backend.ts` + `server/src/db.ts` are an in-memory mock that imports from `./db` (folder) — looks unused now that everything is on Drizzle/tRPC. Confirm and delete; otherwise it's a footgun.

## CI/CD shape I'd suggest

- **PR check** (`.github/workflows/ci.yml`): pnpm install → `lint` + `format:check` + `type-check` + `test` + `build`. Spin up Postgres in a service container, run `db:migrate` against it, then run the `connectivity.test.ts` against a real server.
- **Deploy**: push to `master` → deploy to staging (auto). Tagged release → deploy to production (manual approval). Render has Git-driven deploys; the workflow is mostly "merge → it deploys" with the migration pre-deploy command.
- **Branch strategy**: `master` → staging, `release/*` or tags → production. Or trunk-based with environment promotion.

## Suggested order

1. Decide single Web Service vs Static Site + Web Service topology — drives everything else.
2. Add `build` + `start` scripts that Render can call; delete the stub Dockerfile (Render's Node buildpack is enough).
3. Write `render.yaml` Blueprint declaring staging + production environments, Postgres DB, env var groups; set `pnpm db:migrate` as the Pre-Deploy Command.
4. Make `dotenv` loading no-op on Render (don't mask missing vars).
5. Tighten `devRouter` gating (`=== "development"`, not `!== "production"`) + rotate the committed dev secret.
6. Magic-link transport (Resend/Postmark/SES) + rate-limit `/api/auth/*`.
7. CI workflow (lint, type-check, test, build on PRs).
8. `hono/secure-headers`, structured logging (`pino` + `hono/logger`), `/ready` endpoint hitting `SELECT 1`, graceful shutdown draining the `pg` pool.
9. Observability (Sentry or equivalent).
10. PWA cache scoping per env.

## Open questions to confirm in Render UI

- Exact Starter Postgres connection limit and storage cap.
- Whether Web Service Starter ($7/mo) RAM/CPU is enough for our workload.
- Whether to enable point-in-time recovery on Postgres (available on all paid databases — recommended).
