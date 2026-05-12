---
name: slice
description: Plan and execute an end-to-end feature change across DB schema → migration → tRPC router → frontend query/mutation → component/route. Use when a task touches more than one layer of the stack (Drizzle + tRPC + TanStack Router + React). Ensures nothing is missed in wiring between layers.
---

# Slice

Use this skill whenever a change crosses layers in this repo. Work the layers in order. Do not skip a step silently — if one doesn't apply, say so.

## Stack reminders

- DB: Drizzle ORM (`drizzle-orm/node-postgres`) + Postgres. Schema files live in `server/src/db/schema/*.schema.ts`. Relations in `server/src/db/schema/relations.ts`.
- Migrations: `npm run db:generate` (produces SQL in `drizzle/`), then `npm run db:migrate`.
- tRPC: v11, routers in `server/src/trpc/routers/<feature>.ts`, registered in `server/src/trpc/routers/_app.ts`.
- Client: `@trpc/tanstack-react-query` hooks, features in `client/src/features/<feature>/`, routes in `client/src/routes/_authed/`.
- Typecheck: `npm run type-check` (runs `tsc -b --noEmit` across client + server).

## Checklist

Work through each step. Update the user when a step is complete or skipped.

1. **Schema** — add/modify table or columns in the relevant `server/src/db/schema/*.schema.ts`. Update `relations.ts` if FKs change.
2. **Migration** — run `npm run db:generate`. Review generated SQL in `drizzle/`. Note any backfill the user must run manually.
3. **tRPC router** — add/modify procedure in `server/src/trpc/routers/<feature>.ts`. Use zod for input. Return typed data.
4. **Register** — confirm the router is wired in `server/src/trpc/routers/_app.ts`. New routers will NOT appear on the client until this is done.
5. **Frontend data** — add the `useQuery` / `useMutation` call at the feature's call site. Invalidate related queries on mutation success.
6. **Component / form** — wire inputs, loading, error states in `client/src/features/<feature>/`.
7. **Route loader** — if the route in `client/src/routes/_authed/` prefetches, update the loader too.

## Before reporting done

- Run `npm run type-check`. Report failures, don't hide them.
- Confirm the new procedure shows up on the tRPC client (autocomplete / no `any`).
- If the change is user-visible, start the dev server (`npm run dev:all`) and exercise the golden path + one edge case in the browser. If you can't test it, say so explicitly.
- List any step skipped and why.

## What not to do

- Don't add procedures without registering them in `_app.ts`.
- Don't edit generated SQL in `drizzle/` by hand — regenerate instead.
- Don't mock the DB in integration paths; use the real schema.
- Don't add comments explaining WHAT the code does.