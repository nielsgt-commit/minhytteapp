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

## Deployment topology on Render — DECIDED: single Web Service per env

Hono serves both `/api/*` and the built client static files. One Web Service per env on Starter ($7/mo × 2 = $14/mo for staging + prod, plus Postgres). No CORS, no cross-subdomain cookies, one `BETTER_AUTH_URL` per env, no `VITE_API_URL` indirection — relative `/api/trpc` keeps working.

### Implications

- Add `hono/serve-static` to serve `client/dist`.
- Add an SPA fallback so non-`/api` non-asset paths return `index.html` (TanStack Router needs deep links to work).
- Keep `BETTER_AUTH_URL` and `CORS_ORIGIN` aligned to a single origin per env (already true in current `.env.*`).
- Custom domains: `minhytte.app` (prod), `stage.minhytte.app` (staging). Two DNS records total.

### Render Blueprint (`render.yaml`)

Declare everything as code rather than clicking the dashboard:

- One project, two environments (`staging`, `production`).
- Per env: a Web Service + a Postgres database + an env var group.
- Auto-wire `DATABASE_URL` via `fromDatabase`, generate `BETTER_AUTH_SECRET` per env via `generateValue: true`, and use `fromGroup` for shared keys like `MET_USER_AGENT`.

Benefits: staging and prod stay symmetric by construction, env topology changes go through code review, and cloning to a new region is trivial.

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

1. **Hono serves the SPA**: add `hono/serve-static` for `client/dist` + SPA fallback for non-`/api` routes. Verify deep links and asset paths.
2. **Build + start scripts**: `build` produces the client bundle (`vite build client`); `start` runs `tsx server/src/index.ts` directly — no separate server compile step. Delete the stub Dockerfile (Render's Node buildpack handles it). Add `tsx` to `dependencies` (it currently only lives in `devDependencies`) so Render's production install includes it.
3. **`render.yaml` Blueprint**: declare project → staging + production environments → Web Service + Postgres + env var groups. `pnpm db:migrate` as the Pre-Deploy Command. `BETTER_AUTH_SECRET` via `generateValue: true`, `DATABASE_URL` via `fromDatabase`.
4. **Env loading**: make `dotenv` a no-op when running on Render (so missing vars fail loudly instead of silently).
5. **Tighten `devRouter` gating** (`=== "development"`, not `!== "production"`) + rotate the committed dev `BETTER_AUTH_SECRET`.
6. **Magic-link transport via Resend** + rate-limit `/api/auth/*` (better-auth has built-in options). Add `resend` to dependencies, `RESEND_API_KEY` + `MAGIC_LINK_FROM` to env contract (`.env.example`, staging, production), and replace the `console.log` / `throw` branches in `server/src/auth/auth.ts` (`sendMagicLink`) with a single Resend call. Use a verified sending domain (`auth@minhytte.app`) — needs DNS records (SPF + DKIM) in the Render-managed DNS or wherever the apex is hosted. Staging can send from the same domain (different `from` address or just same one) so the flow is genuinely exercised.
7. **CI workflow** (`.github/workflows/ci.yml`): lint, type-check, test, build on PRs. Postgres service container + `db:migrate` to exercise `connectivity.test.ts`.
8. **Hardening**: `hono/secure-headers`, structured logging (`pino` + `hono/logger`), `/ready` endpoint hitting `SELECT 1`, graceful shutdown draining the `pg` pool on SIGTERM.
9. **Observability** (Sentry or equivalent, server + client).
10. **PWA cache scoping per env** (so staging/prod don't share a cache namespace in the same browser).
11. **Delete dead code**: `server/src/backend.ts` + `server/src/db.ts` if confirmed unused.

## Open questions to confirm in Render UI

- Exact Starter Postgres connection limit and storage cap.
- Whether Web Service Starter ($7/mo) RAM/CPU is enough for our workload.
- Whether to enable point-in-time recovery on Postgres (available on all paid databases — recommended).
