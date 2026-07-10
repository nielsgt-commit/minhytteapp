# Plan 05 — Test coverage expansion

> Finding #5 in [architecture-review-2026-07-10.md](../architecture-review-2026-07-10.md).
> Status: ALL BLOCKS DONE 2026-07-10. A: settlement.test.ts (17 tests incl. the 04c admin-refused case) + test-utils, commit 73656c2. B: fakeTrpcClient harness + targetToken/TargetSelect extraction + 13 Todos tests, commit 5101e2f (jsdom lessons in the commit message: stateful fake handlers; settle held-open form actions). C: 7 ShoppingList tests, commit 275fda0. D: user/todo/inspection router tests (20), commit 46c4bd7 (delegated to an agent; one pinned asymmetry: processFindings accepts "ok" on foreign step ids). E: typed exhaustive router-mount probes in connectivity.e2e.test.ts + testing.md refresh, commit 62eee8c — the plan's premise was stale (per-router calls were removed in the tRPC lockdown), so probes assert not-NOT_FOUND unauthenticated instead. Browser e2e skipped as planned.

**Correction to the finding:** settlement is not as bare as stated — `server/src/services/settlementSplit.test.ts` (pure split math), `server/src/shared/splitPolicy.test.ts` (phase-order helpers `nextPhaseIn`/`prevPhaseIn`/`requiredPhases`), and `server/src/trpc/settlementGating.test.ts` (router-level phase gating + previewSplit dispatch, using the same rollback pattern) already exist. What is genuinely untested at router level is the settlement _mutation_ surface: `acceptSplit`, `advancePhase`/`regressPhase` (validation, concurrency, side effects), and `markTransferPaid`. The plan below targets that precisely.

## Established patterns to reuse

**Server (integration, real Postgres, rollback)** — from `server/src/trpc/routers/booking.test.ts` and `server/src/trpc/settlementGating.test.ts`:

- `createCallerFactory(appRouter)` + `ctxFor(tx, authUser(row))` fake context, `withRollback(fn)` wrapping each test in a `db.transaction` that throws a sentinel `Rollback` error, `afterAll(() => pool.end())`, seed helpers inserting property/users/group/owners directly via Drizzle. Run with `pnpm test:server`.
- The `authUser()` / `ctxFor()` / `withRollback()` boilerplate is now copy-pasted in 4 files. First step of Block A: hoist it into `server/src/trpc/test-utils.ts` (booking/expense/gating tests can migrate opportunistically; don't block on it).

**Client (jsdom, vitest, testing-library)** — two patterns exist:

1. Shallow `vi.mock("@tanstack/react-query")` (e.g. `UserSettings.test.tsx`). **Unsuitable here**: it stubs `useMutation`, which is exactly the optimistic-update machinery we need to exercise.
2. `client/src/test-utils/renderWithProviders.tsx` — real `QueryClient`, real router, real `TRPCProvider`, and crucially accepts a `trpcClient` override and a `seed(queryClient)` callback. This is the right harness; it is currently underused (only its own self-test uses `seed`).

**Missing harness piece (build once, Block B step 1):** `client/src/test-utils/fakeTrpcClient.ts` — a `createTRPCClient<AppRouter>({ links: [fakeLink(handlers)] })` where `fakeLink` is a custom _terminating_ tRPC link returning an `observable` that resolves canned data or rejects per `op.path` (e.g. `handlers["todo.create"] = vi.fn(async input => ...)` or `() => Promise.reject(new TRPCClientError(...))`). No HTTP, no msw, no transformer needed. Because `TRPCProvider` builds the `useTRPC()` options proxy from this client, the component's real `queryOptions`/`mutationOptions`/`onMutate`/`onError` code runs unmodified against a real QueryClient — which is the only way to genuinely test optimistic caching and rollback.

---

## Block A — Settlement router integration tests (highest value)

**File:** `server/src/trpc/routers/settlement.test.ts` (mutation lifecycle) — plus the shared `server/src/trpc/test-utils.ts` extraction.

**Why first:** this is money logic with hand-rolled optimistic-concurrency guards, cross-table side effects, and multi-actor authorization — the highest bug-density surface in the repo, and the failure mode (wrong money split persisted at close) is the worst in the app. Seed helpers can be adapted from `settlementGating.test.ts` (it already seeds settlements + split policies).

Cases, in suggested `describe` blocks:

- **`advancePhase`** (settlement.ts:1148)
  - happy path each legal step of the full chain (`collecting_expenses → collecting_bookings → reviewing → split_policy`) for a default (no-policy) settlement
  - policy without `booking_days` parameter: `collecting_expenses → reviewing` allowed, `→ collecting_bookings` rejected `BAD_REQUEST` (complements gating test, which covers `requiredPhases` but not the advance mutation)
  - illegal skip (`collecting_expenses → split_policy`) rejected `BAD_REQUEST`
  - non-head member rejected `FORBIDDEN`; non-member rejected (IDOR guard via `assertPropertyMember`)
  - **concurrency guard:** `from` no longer matches current phase → `CONFLICT` (line 1195) — simulate by advancing once, then replaying the same `{from, to}`
  - **expense-pull side effect on entering `reviewing`** (lines 1204–1221): heads' `submitted` expenses with `settlement_id IS NULL` get linked; assert draft expenses, non-head payers' expenses, other properties' expenses, and already-settled expenses are NOT pulled
- **`regressPhase`** (settlement.ts:1225)
  - legal single-step back; illegal skip rejected
  - regressing **from `split_policy` deletes acceptance rows** (line 1260/1275) — accept as one head, regress, assert `settlementAcceptancesTable` empty and re-advancing requires fresh acceptances
  - regress from other phases does NOT clear acceptances; head-only `FORBIDDEN`; concurrency `CONFLICT`
- **`acceptSplit`** (settlement.ts:668)
  - wrong phase rejected `BAD_REQUEST` (line 692); non-head `FORBIDDEN`
  - two-head property: first accept returns `{accepted_count: 1, closed: false}` and phase stays `split_policy`
  - second head accepts → `closed: true`, settlement `phase/status = closed`, `closed_at` set, `settlementUserGroupTotalsTable` and `settlementTransfersTable` rows persisted matching `previewSplit` output (seed a couple of settled expenses so transfers are non-empty)
  - **idempotency:** same head accepting twice (`onConflictDoNothing`, line 721) does not double-count or close a 2-head settlement
- **`markTransferPaid`** (settlement.ts:1079)
  - recipient-group head marks paid → `status: "paid"`, `paid_at` set
  - head of the _paying_ group rejected `FORBIDDEN` (line 1126); non-head member `FORBIDDEN`; non-member IDOR rejected
  - already-paid transfer returned unchanged (idempotent, line 1132) — assert `paid_at` not bumped
- **`update`/`delete` phase locks** and `setBookingExcluded/setBookingExtras` gating via `assertCanEditBookingAdjustments` (line 202): edit allowed in collecting phases, rejected in `reviewing`/`split_policy`/`closed` — 3–4 quick cases

**Effort:** ~1 day (seed helper adaptation is the bulk; each case is then ~10 lines).

---

## Block B — Todos.tsx client tests (+ cheap extraction)

**Extraction first (recommended, tiny):** move `parseTargetToken`, `NO_TARGET`, `Target`/`TargetKind`, and the presentational `TargetSelect` out of `Todos.tsx` into `client/src/features/todos/targetToken.ts` + `TargetSelect.tsx`, exporting `parseTargetToken`. This is ~30 min, makes the parser trivially unit-testable, and shrinks `Todos.tsx` — but write the _component_ tests against accessible roles/labels at the page level so they survive whatever the other refactor plans do to the file's internals. If the refactor plans land a different decomposition, only the import paths of the unit test move; do not block on them.

**File 1:** `client/src/features/todos/targetToken.test.ts` (pure, ~30 min)

- valid tokens for all three kinds; empty string → `undefined`
- garbage kind (`"room:5"`), non-numeric id, `0`/negative id, missing colon, `"structure:"` → `undefined`

**File 2:** `client/src/features/todos/Todos.test.tsx` (the meat, ~1 day)

Setup: `renderWithProviders(<Todos />, { initialSearch: { property: 1 }, trpcClient: fakeTrpcClient, seed })` — seed the five list query caches (`todo.listForProperty`, `structure/infrastructure/equipment.listForProperty`, `user.listForProperty`) via `queryClient.setQueryData` using `trpc.<x>.queryKey(...)` from a proxy built on the fake client, so no fetch fires. jsdom shims needed: `HTMLDialogElement` methods (PageHelp — copy the `beforeAll` from `UserSettings.test.tsx`) and `window.matchMedia` (for `useIsMobile`). React 19 `form action={}` submits work with `fireEvent.submit`/userEvent + `requestSubmit`.

Cases (bug-catching order):

- **Optimistic add + rollback:** submit the add form with a handler that stays pending → new todo text appears immediately at the top of the list (onMutate insert, temp id = max+1); then a handler that rejects → item disappears again (rollback to `ctx.previous`) and the aggregated `ErrorAlert` shows
- **Optimistic toggle-done + rollback:** checkbox flips immediately; on rejection reverts
- **Optimistic delete:** click Delete → confirm flow (Cancel keeps item; Confirm removes it immediately); rejection restores it
- **Assign/unassign:** open "Assign to...", check a user chip → name appears in the row's assignee line immediately; uncheck removes; rollback on error
- **Move to maintenance:** choosing a target in `TargetSelect` removes the row optimistically and calls `todo.moveToMaintenance` with the parsed `{kind, id}`; selecting "No target" is a no-op (guard in `handleMove`); on success both `todo` and `maintenance` path keys are invalidated (spy on `queryClient.invalidateQueries` or assert refetch handlers were called)
- **Sorting:** items render newest-first with id tiebreak (seed same-instant rows)
- **Empty/loading/no-property states:** skeleton while `items` undefined; `EmptyState` when empty; add form disabled when no property selected
- **Edit inline:** Edit → change text → Save calls `todo.update` with new description and exits edit mode; blank description is a no-op

**Effort:** extraction 0.5 h, unit test 0.5 h, harness (`fakeTrpcClient.ts`) 2–3 h, component test ~1 day. The harness is reusable for Block C and every future feature test — that's most of its ROI.

---

## Block C — ShoppingList.tsx client tests

**File:** `client/src/features/shoppinglist/ShoppingList.test.tsx` (~0.5 day, reusing the Block B harness)

- optimistic create per section + rollback on error
- optimistic toggle-checked + rollback
- delete confirm flow; clear-section (`clearSectionMutation`) removes all checked items of that section and only that section
- the two `setTimeout`-based behaviors around lines 161/171 (auto-collapse/auto-clear timers) — use `vi.useFakeTimers()`; timers interacting with optimistic caches is a classic bug nest
- empty/loading states; aggregated error via `useMutationsStatus`

---

## Block D — Remaining server routers (targeted, not exhaustive)

Order by risk; use the shared `server/src/trpc/test-utils.ts` from Block A. Don't chase full CRUD coverage — `authorization.test.ts` already sweeps IDOR on reads; test only writes with real logic.

1. **`user.ts`** (730 lines, 17 `TRPCError` sites) — `server/src/trpc/routers/user.test.ts`, ~0.5 day: child create/link/unlink invariants (parent-only edits, child cannot be head), `updateMyHeadForProperty` scoping, `listLinkableParents` filtering.
2. **`todo.ts`** — fold 3 cases into a small `todo.test.ts` (~1–2 h): the asymmetric authz seam (everything is `propertyAdminProcedure` but `delete` is `protectedProcedure` + `assertPropertyMember` — verify a plain member can delete but a non-member cannot), and `moveToMaintenance` creating the maintenance row with the right target kind/id and removing the todo.
3. **`inspection.ts`** (554 lines) — ~0.5 day: procedure-step completion transitions and whatever multi-row write logic its 6 error sites guard.
4. **`stay.ts` / `maintenance.ts` / `priority.ts`** — thin routers (2–6 error sites); one happy path + one authz rejection each, ~2 h total. Lowest priority; skip if time-boxed.

---

## Block E — E2E: honest recommendation

**Do not invest in browser e2e now.** Rationale:

- No Playwright/browser driver exists in the repo; standing one up is 1–2 days of infra for a single-developer app whose UI the user verifies manually anyway.
- Every failure class the finding worries about (phase-transition bugs, optimistic rollback, authz) is covered _more precisely and hermetically_ by Blocks A–D: router caller tests exercise the same code as an HTTP request minus serialization, and the serialization/mount boundary is exactly what the existing connectivity smoke already proves.
- The one cheap e2e improvement worth doing (~1 h): follow the documented convention in `.docs/testing.md` ("Adding a new router to the check") and extend `client/src/trpc/connectivity.e2e.test.ts` with one read procedure for each unlisted router (`todo`, `shoppingItem`, `inspection`, `stay`, `user`, `priority`, ...), so a broken router mount or renamed procedure fails fast and type-checks against `AppRouter`.
- Revisit browser e2e only if a second contributor joins or a regression escapes that Blocks A–D could not have caught.

---

## Sequencing & effort summary

| Order | Block                                                                   | Effort      | Value                                                                       |
| ----- | ----------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| 1     | A: settlement router tests (+ shared server test-utils)                 | ~1 day      | Highest — money, concurrency, side effects                                  |
| 2     | B: fakeTrpcClient harness + Todos tests (+ parseTargetToken extraction) | ~1.5 days   | High — most complex component, 6 optimistic mutations; harness pays forward |
| 3     | C: ShoppingList tests                                                   | ~0.5 day    | Medium-high — reuses harness, timer bugs                                    |
| 4     | D: user/todo/inspection/stay routers                                    | ~1–1.5 days | Medium, decreasing                                                          |
| 5     | E: extend connectivity smoke; no browser e2e                            | ~1 h        | Cheap insurance                                                             |

Coordination note: Blocks B/C tests should query by role/label (page-level behavior), so they double as the safety net for any Todos/ShoppingList decomposition refactor from the other findings — land Block B _before_ that refactor if possible. Block A's characterization tests overlap with Plan 01 Step 0 — if doing both plans, write them once.

## Critical files

- `server/src/trpc/routers/settlement.ts`
- `server/src/trpc/routers/booking.test.ts` (pattern to extract into shared test-utils)
- `client/src/features/todos/Todos.tsx`
- `client/src/test-utils/renderWithProviders.tsx`
- `client/src/trpc/client.ts` (template for the fake-link trpc client)
