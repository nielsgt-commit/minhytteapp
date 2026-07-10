# Architecture & readability review — 2026-07-10

Full-codebase review (client + server) focused on architecture and readability.
Each numbered weakness has a corresponding implementation plan in
`.docs/plans/0N-*.md`, ready to pick up independently.

## Verdict

An unusually disciplined codebase. Strict TypeScript with type-aware lint at the
strictest presets, zero `@ts-ignore` and zero TODO/FIXME anywhere, hand-written
`any` count of two (both justified with disable comments), and intent-explaining
comments of genuinely high quality. The architecture is coherent: thin routes →
feature folders → tRPC → routers → services/shared kernel → Drizzle, with strong
DB-level invariants. The debts are concentrated and nameable: two oversized
routers, verbatim bilingual route duplication, porous feature boundaries on the
client, and a handful of copy-paste patterns that want a shared abstraction.

## What's working architecturally

**The isomorphic shared kernel is the standout design.** `server/src/shared/`
(`splitPolicy.ts`, `bedOccupancy.ts`, `season.ts`, `temporal.ts`,
`transformer.ts`) is the single source of truth for domain rules consumed by
both sides. The client's reach into server code is limited to exactly 6
modules — two type-only (`AppRouter`, `Auth`) and the four isomorphic ones — via
consistent `@server/*` aliases in tsconfig and both vite configs. Each shared
file documents its own constraints ("only temporal-polyfill/zod/superjson, no
node builtins"). Enums like `BookingStatus` and the tent sentinel are defined
once, so client/server can't drift.

**The Temporal wire convention is applied with real consistency.** One SuperJSON
transformer registers PlainDate/Instant/PlainDateTime codecs; every router has a
`toWire*` helper converting DB Date columns at the handler edge — 20 of them,
all following the same shape. The convention holds everywhere; the cost is the
duplication (weakness 4a).

**Authorization is layered sensibly for an app with no RLS.** `init.ts` gives a
procedure ladder (`public` → `protected` → `admin`/`headOrAdmin` →
`propertyAdminProcedure`), `propertyAccess.ts` holds the
`resolvePropertyIdFrom*` family for child-entity lookups, and the head-vs-admin
distinction (settlement participation requires _real_ membership, deliberately
not satisfied by the admin flag) is documented right where it's enforced
(`init.ts:44-99`). Dedicated authz tests (`authorization.test.ts`,
`expense.authz.test.ts`, `settlementGating.test.ts`) back this up — appropriate
given app-layer authz is the only row-level security.

**The client's state model is deliberately minimal.** No global state library;
server cache is TanStack Query, property/user selection lives in URL search
params (validated by `selection/searchSchema.ts`, seeded in `_authed.tsx`), and
there is exactly one React context in the whole client (the split-policy builder
form). Route files are thin — a loader prefetch plus a component pointer — and
`components/shared/query-states/` (`QueryBoundary`, `ErrorAlert` at 48 import
sites) gives one consistent, accessible loading/error pattern.

**`planstay/booking-logic` is the model the rest of the client should aspire
to:** a pure, React-free reducer with a documented occupants-first design,
action creators, colocated tests, and a barrel `index.ts` defining the feature's
public surface. Wizard steps are presentation-only. Settlement's
`splitpolicybuilder` (discriminated-union domain types + 418-line test) is
similarly strong.

**Infra edges are handled like production software:** graceful SIGTERM pool
drain, `/health` vs `/ready` probes, canonical-host redirect registered after
health routes (with the why explained), dev-only tRPC error detail, CHECK
constraints and partial unique indexes in the settlement schema
(one-open-settlement-per-property, `closed ⇔ closed_at`), optimistic-concurrency
phase transitions that throw `CONFLICT` on lost races.

## Weaknesses, ranked by value of fixing

### 1. Oversized routers hold orchestration that belongs in services

Plan: `.docs/plans/01-extract-router-services.md`

`settlement.ts` (1,290 lines) and `booking.ts` (1,177). Settlement is the worse:
phase-transition validation, `resolveSettlementParameters`, and a real business
rule — pulling submitted expenses into the pot on entering `reviewing`
(`settlement.ts:1204-1221`) — all live inline in mutation handlers, with 34
`TRPCError` sites in one file. Booking is better factored (named module-level
helpers like `assertBookingsUnlocked`, `computeBookingRooms`) but those helpers
still live in the router file. A `settlementPhase` service mirroring
`settlementSplit` is the highest-value extraction. These two largest files are
also the thinnest on router-level integration tests (booking has some;
settlement has none).

### 2. Bilingual route duplication

Plan: `.docs/plans/02-bilingual-route-dedup.md`

Every user-facing route exists twice (`todos.tsx`/`oppgaver.tsx`,
`settlement`/`oppgjor`, the whole `manageproperty`/`administrer` subtree — ~9
pairs), byte-identical except the route id, reconciled by a hardcoded
`routeEquivalents.ts` map. The loaders are kept in sync by hand; this is the
single largest duplication in the repo and an easy place for silent drift.

### 3. Client feature boundaries are convention, not structure

Plan: `.docs/plans/03-feature-boundaries.md`

Only `booking-logic` has a public barrel; everything else is reach-in:
`staysummary` imports `usergroups/groupColors` and `seasons/seasonUtils`,
onboarding reaches into `property/register`, and `settlement ⇄ expenses` is
circular at the feature level (`SettlementHeadsProgress` imports expense
selectors while `reviewexpenses` imports settlement's `phase` and `StepBadge`).
De-facto shared modules (`seasonUtils`, `groupColors`, `StepBadge`,
`managePropertySection.module.css`) should either move to
`components/shared`/`utils` or the features need explicit public surfaces. Same
theme on the server: nothing but convention (and the dual typecheck) stops a
`pg` import landing in `server/src/shared/` — a `no-restricted-imports` lint
rule would make the isomorphic contract enforceable.

### 4. Recurring patterns that want one abstraction each

Plan: `.docs/plans/04-pattern-consolidation.md`

- 20 hand-written `toWire*` converters, each hand-listing timestamp columns — a
  forgotten column ships a raw `Date` to the client silently. A small factory
  would remove ~200 lines and that failure mode.
- `useEquipmentCategoryMutations.ts` is an admitted 88-line clone of the expense
  `useCategoryMutations.ts` (its own comment says "Mirror of…"), differing only
  in the tRPC namespace; the two backing routers share the same CRUD+soft-delete
  shape.
- The "head" gate is expressed three different ways in settlement:
  `propertyHeadOrAdminProcedure` exists in `init.ts:134` but
  `advancePhase`/`regressPhase` roll `assertPropertyMember` + inline
  `isPropertyHead` by hand instead.
- Two mutation conventions coexist at roughly 50/50:
  `useMutationWithInvalidation` (44 sites) vs raw `mutationOptions` + manual
  invalidation (47 sites).

### 5. Test coverage is well-aimed but uneven

Plan: `.docs/plans/05-test-coverage.md`

The philosophy — heavily test pure domain logic (settlement math, bed occupancy,
booking reducer, split-policy types) plus authz — is right, and those areas are
genuinely well covered. The gaps: `Todos.tsx` is the client's most complex
component (678 lines, 22 hooks, six mutations with optimistic caching) and is
essentially untested, as are `shoppinglist` and most server routers at the
integration level. E2E is a connectivity smoke test only.

### 6. Small latent items

Plan: `.docs/plans/06-small-latent-items.md`

- `db/client.ts` registers only 8 of the 12 schema modules with Drizzle (missing
  dinner, shopping, stay, todo) — `db.query.*` is unused in production code so
  nothing is broken today, but the relational API would silently fail for those
  tables.
- `context.ts` runs an extra `is_head_anywhere` query on every request (fine at
  current scale).
- `en/category.json` has no `nb` sibling.
- Folder naming is mostly `lowercaseruns` (`splitpolicybuilder`,
  `maintenancecard`) but `booking-logic`/`query-states` are kebab-case.

## Corrections found during planning

The plan agents ground-truthed each finding; four details in this review turned
out to be overstated (plans have the accurate picture):

- **#2:** only the 9 top-level route pairs are true duplicates; the
  `manageproperty/*` subtree is already 13 redirect stubs to `administrer/*` —
  NB is de facto canonical.
- **#4:** the mutation-convention split is not ~50/50; it is 119
  `useMutationWithInvalidation` sites vs 5 deliberate raw `useMutation` sites,
  so unification is a doc + lint guard, not a sweep.
- **#5:** settlement is partially tested (`settlementGating.test.ts` covers
  phase gating); the genuinely untested surface is the mutation lifecycle
  (`acceptSplit`, `advancePhase`/`regressPhase`, `markTransferPaid`).
- **#6:** `en/category.json` is empty (`{}`) and unregistered — the fix is
  deletion, not an nb translation.

## Readability specifically

The best quality of this codebase is that **comments explain intent and
invariants, not mechanics** — the head-vs-admin rationale, the canonical-host
redirect history, why bookings lock, why the tent sentinel is `-1`, the Drizzle
date string-mode footgun. Naming is predictable enough to guess
(`resolvePropertyIdFrom*`, `assert*`, `toWire*`, `*Table`), date formatting is
100% centralized in `dateUtils.ts` (zero stray `toLocaleDateString` calls), and
there's no dead-code or debt-marker noise at all. Where readability suffers is
exactly where size does: `settlement.ts`, `Todos.tsx` (inline `parseTargetToken`
parser + sub-component + optimistic cache juggling in one file), and
`StaySummaryCompact.tsx` (759 lines mixing date math, season resolution, and
layout — well-commented, but a `useStaySummaryModel` extraction would pay off).
