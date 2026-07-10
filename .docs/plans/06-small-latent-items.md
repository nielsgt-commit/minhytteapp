# Plan 06 — Small latent items batch

> Finding #6 in [architecture-review-2026-07-10.md](../architecture-review-2026-07-10.md).
> Status: DONE — executed 2026-07-10, commit 2f7a986 (all four items; option 1 taken for (b), deletion taken for (c)).

Baseline verification for every item: `pnpm type-check`, `pnpm test:server`, `pnpm test`. Note: `pnpm i18n:check` **fails pre-existing on master** (measured drift: 12 of 19 namespaces have en/nb key-set differences, worst is `property.json` with ~100 differing keys) — only compare its output before/after, never treat a red run as caused by this batch. Do **not** run `pnpm i18n:extract` (it deletes dynamically-referenced keys; locale files are hand-edited).

## (a) Register the 4 missing schema modules in the drizzle client — DO

**Verified state:** `server/src/db/client.ts` imports/spreads 8 modules; `dinner.schema.ts`, `shopping.schema.ts`, `stay.schema.ts`, `todo.schema.ts` are missing. `server/src/db/schema/relations.ts` (487 lines) imports `stayTable` (line 29) and `dinnerResponsiblesTable` (line 30) — so two of the four missing modules are already referenced by registered relations (todo/shopping are not referenced by relations.ts at all, slightly narrower than the review stated). `grep -rn "db\.query\." server/src` confirms the relational API is unused in production code, so nothing is currently broken.

**Edit** `server/src/db/client.ts`:

1. Add four imports after line 9 (`event.schema.ts`), matching existing style:
   ```ts
   import * as dinner from "./schema/dinner.schema.ts"
   import * as shopping from "./schema/shopping.schema.ts"
   import * as stays from "./schema/stay.schema.ts"
   import * as todos from "./schema/todo.schema.ts"
   ```
2. Spread them in the `schema: { ... }` map before `...relations`.

**Implications to note in the commit message:**

- Runtime: drizzle builds the relational config once at startup; four extra modules is negligible memory and does not change any generated SQL for the existing query-builder calls.
- Types: `typeof db` (aliased as `Db` in `server/src/trpc/init.ts:12`) grows to include `db.query.<newTables>` — marginal tsc work, no behavioral change. This is what makes `db.query.*` usable/correct if anyone adopts the relational API later.

**Verify:** `pnpm type-check && pnpm test:server`. Expect zero diffs in behavior; if paranoid, `pnpm dev:server` boots clean.

## (b) Per-request `is_head_anywhere` lookup in context.ts — ASSESS, recommend leave-as-is + document

**Verified consumers of `ctx.user.is_head_anywhere`:**

- `server/src/trpc/init.ts:35` — `headOrAdminProcedure`, which is used **only** by `server/src/trpc/routers/allowedEmail.ts` (4 procedures: `list`, `add`, `assignGroup`, `remove` — invite management).
- `server/src/trpc/routers/user.ts` `me` — spreads `...ctx.user`, so `is_head_anywhere`/`is_head` go over the wire. However, grep shows **no client code reads `me.is_head` or `me.is_head_anywhere`** — all client `.is_head` usages (SettlementHeadsProgress.tsx:76, GroupCard.tsx:183, ProfileSection.tsx:131, splitpolicybuilder/types.ts:429, useReviewSettlementData.ts:70) are on membership/list rows from other endpoints.

**Options assessed:**

1. **Leave as-is + document (RECOMMENDED).** Cost is one indexed `SELECT ... LIMIT 1` join per authenticated request — sub-millisecond against the same pool. Zero risk.
2. Per-session cache — rejected: stale-authorization hazard (a demoted head keeps `headOrAdminProcedure` access until session refresh) plus new cache infrastructure. Not worth it for one cheap query.
3. Fold into session lookup — rejected: `auth.api.getSession` is better-auth; a `customSession` plugin would still issue the same query, just relocated. No saving.
4. Lazy: move the lookup into `headOrAdminProcedure` and derive `is_head_anywhere` inside `user.me` (which already queries `is_head` across memberships at user.ts:148-160). This genuinely eliminates the per-request query, but it changes the `AuthUser` shape and touches at least 4 test files that stub `is_head_anywhere` (authorization.test.ts:36, settlementGating.test.ts:36, expense.authz.test.ts:33, booking.test.ts:32) plus the client `me` wire type. Medium churn for a micro-win — keep as the documented "if it ever matters" path.

**Edit (option 1):** add a short comment above `context.ts:51` stating: runs on every authenticated request; single indexed LIMIT-1 lookup; consumed by `headOrAdminProcedure` and `user.me`; deliberately not cached because head status gates authorization and must be fresh; the lazy alternative is option 4 above.

**Verify:** `pnpm type-check` (comment-only change; trivially green).

## (c) i18n `category.json` — DO, but the fix is deletion, not translation

**Verified state differs from the review's assumption.** `client/src/i18n/locales/en/category.json` contains exactly `{}` — zero keys. It is **not imported** in `client/src/i18n/index.ts`, not in the `ns` array, and no code references a `category` namespace (`useTranslation("category")` grep: no hits). Git history shows it survived commit `7c16030` ("refactor to hooks and delete some unused files") as an orphan. There are no keys to translate, so creating `nb/category.json` would just enshrine a dead namespace.

**Edit:** delete `client/src/i18n/locales/en/category.json`. No other file changes needed (nothing imports it). This is safe w.r.t. the "extract deletes dynamic keys" lore because deletion is manual and the file is empty and unreferenced.

Contingency: if the create-nb variant is insisted on instead, the nb file would also be `{}` — but registering an empty namespace in index.ts adds noise for nothing; deletion is strictly better.

**Verify:** `pnpm type-check && pnpm test` (index.ts has no import of it, so build is unaffected); `pnpm i18n:check` output should be unchanged or one entry shorter vs. master baseline.

## (d) Feature folder naming — ASSESS, recommend document-don't-rename

**Verified state:** 40+ feature subfolders use lowercase-runs (`splitpolicybuilder`, `maintenancecard`, `addstayflow`, `reviewsettlement`, ...). Exactly two kebab-case outliers: `client/src/features/planstay/booking-logic` and `client/src/components/shared/query-states` (note: query-states is under `components/shared/`, not `features/`). Plus route-dir convention `routes/_authed/administrer/-priority` (TanStack Router's `-` prefix — unrelated, leave alone).

**Recommendation: do not rename.** Renaming 2 directories costs import updates across their consumers, `routeTree.gen.ts` regeneration risk if any route file imports move, and breaks `git log --follow`-less history browsing — all to fix something with zero runtime or tooling impact. Instead add one line to the project conventions doc (CLAUDE.md or equivalent):

> Feature and component folder names are single lowercase runs with no separators (e.g. `splitpolicybuilder`, `maintenancecard`); `booking-logic` and `query-states` are grandfathered legacy exceptions — do not add new kebab-case folders.

**Verify:** none needed (docs only).

## Optional quick wins spotted (max 3, all sub-500-line)

1. **Empty registered namespaces:** `en/layouts.json` and `en/user.json` both have 0 keys (nb counterparts also empty) yet are fully wired through `i18n/index.ts` (imports, `resources`, `ns`). Either they are dead like `category.json` (then unwire + delete, ~10-line diff) or they mask components whose keys were never extracted — investigate `useTranslation("layouts")`/`("user")` call sites before deleting.
2. **Transitional `is_head` alias:** `AuthUser.is_head` (context.ts:19-20) is kept "for client compat" but no client code reads it off `me` (verified above). Dropping the alias from `AuthUser` + `user.me` is a small cleanup that pairs naturally with item (b)'s option 4 if that path is ever taken; standalone it is a ~20-line diff plus test-fixture touches.
3. **en/nb key drift backlog:** the measured drift (12 namespaces, `property.json` worst at ~100 key differences) is the real cause of the pre-existing `pnpm i18n:check` failure. Too large for this batch (>500 lines of hand-written Norwegian), but worth filing as its own item so i18n:check can become a CI gate.

## Suggested execution order

(a) client.ts registration → (c) delete category.json → (b) comment in context.ts → (d) convention line in docs — four independent, individually revertable commits; run `pnpm type-check && pnpm test:server && pnpm test` after (a) and (c).

## Critical files

- `server/src/db/client.ts`
- `server/src/trpc/context.ts`
- `client/src/i18n/locales/en/category.json` (delete)
- `client/src/i18n/index.ts` (reference only — confirms category is unregistered)
- `server/src/trpc/init.ts` (reference for item b's consumer analysis)
