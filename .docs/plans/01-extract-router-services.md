# Plan 01 — Extract settlement and booking orchestration into services

> Finding #1 in [architecture-review-2026-07-10.md](../architecture-review-2026-07-10.md).
> Status: DONE — all steps executed 2026-07-10 (uncommitted as of writing). settlement.ts 1290→708, booking.ts 1177→858. New: services/settlementPhase.ts, services/settlementPreview.ts, services/booking.ts (+ computeOccupantQueued/occupantRowValues dedupe), tests for each, shared trpc/test-utils.ts (with dbFor bridge for direct service calls). 01-1 kept suggestion applied (server-only header comments in each service). 140 server + 493 client tests green.

## Ground truth (verified)

- All module-level helpers in `settlement.ts` and `booking.ts` are file-private — `grep` confirms zero imports from other files. Extraction is a pure move with no ripple.
- Service convention (`server/src/services/settlementSplit.ts`): plain module, `type Db = typeof dbClient`, `db` as first arg, exported types. Note: `settlementSplit.ts` throws no `TRPCError`; the code being moved does. Keep the `TRPCError` throws in the new services (pure move — tRPC propagates them from anywhere inside a procedure); converting to domain errors is a separate follow-up, not this refactor.
- Test convention (`booking.test.ts`, `settlementGating.test.ts`): `createCallerFactory(appRouter)`, `ctxFor(tx, user)` casting a transaction into `Context`, `withRollback` wrapping each test in a rolled-back transaction against real Postgres. Pure-compute tests (`settlementSplit.test.ts`) need no DB. Suite runs via `pnpm test:server` (`server/vitest.config.ts`, includes `src/**/*.test.ts`, DB on `:5432`).
- Type check: `pnpm type-check` (`tsc -b --noEmit`).

## New files

1. `server/src/services/settlementPhase.ts` — phase machinery + heads lookup
2. `server/src/services/settlementPreview.ts` — preview/close split computation
3. `server/src/services/booking.ts` — booking allocation domain logic
4. Tests: `server/src/trpc/routers/settlement.test.ts`, `server/src/services/settlementPhase.test.ts`, `server/src/services/booking.test.ts`

## Step 0 — Characterization tests first (pin behavior before moving anything)

Create `server/src/trpc/routers/settlement.test.ts` modeled on `settlementGating.test.ts` (reuse its `seed`/`withRollback`/`authUser` pattern; don't duplicate what it already covers — advance/regress gating and the reviewing expense-pull are tested there). Add coverage for:

- `acceptSplit`: non-head → FORBIDDEN; wrong phase → BAD_REQUEST; single-head property closes the settlement and persists `settlementUserGroupTotalsTable` + `settlementTransfersTable` rows (verify via `getClosedSummary`).
- `setBookingExcluded` / `setBookingExtras`: allowed in `collecting_expenses`/`collecting_bookings`, FORBIDDEN once phase is `reviewing` (pins `assertCanEditBookingAdjustments`, settlement.ts:202-249).
- `previewSplit` legacy occupancy path with real bookings: excluded booking dropped, `extra_names` credited to the booker's group, rounding drift assigned to largest-days group (pins settlement.ts:453-522).
- `regressPhase` from `split_policy` clears acceptances (pins settlement.ts:1260-1281).
- `markTransferPaid`: recipient-group head only; idempotent when already paid.

Optionally extend `booking.test.ts` with: queued inference on room overflow, `sleeps_separately` nulling `room_id`, and `assertBookingsUnlocked` FORBIDDEN when an open settlement for the overlapping year is in `reviewing`.

Verify: `pnpm test:server` green against the _current_ routers.

## Step 1 — `server/src/services/settlementPhase.ts`

Move verbatim from `server/src/trpc/routers/settlement.ts`:

| Function                                                            | Current lines | Notes                                                                                    |
| ------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `resolveSettlementParameters(db, splitPolicyId)`                    | 88-102        | export                                                                                   |
| `listSettlementHeads(db, propertyId)`                               | 178-200       | export (used by preview service too)                                                     |
| `assertCanEditBookingAdjustments(db, settlementId, userId, isHead)` | 202-249       | already takes `isHead` as a param, so no dependency on `trpc/init.ts` — keep it that way |

Then extract the two mutation bodies as service functions returning the **raw** updated row (router keeps `toWireSettlement`):

- `advanceSettlementPhase(db, { settlementId, propertyId, from, to })` — from `advancePhase` lines 1165-1221: policy lookup, `nextPhaseIn`/`requiredPhases` validation (BAD_REQUEST), compare-and-swap update (CONFLICT), and the business rule at 1204-1221 (pull heads' submitted, unlinked expenses into the pot on entering `reviewing`). Move the existing comment with it. Note: today the phase update and expense pull are two statements **not** in one transaction — keep that as-is (pure move); flag wrapping them in a transaction as a separate follow-up since it changes failure behavior.
- `regressSettlementPhase(db, { settlementId, from, to })` — from `regressPhase` lines 1242-1288, including the `db.transaction` that clears acceptances when leaving `split_policy` (1260-1281). The `db.transaction` call moves _into_ the service unchanged.

Stays in the router: zod inputs (`phaseEnum`, 83; input schemas 566-580), `resolveSettlementPropertyId` (128-149) and `resolveTransferPropertyId` (151-176) — these exist to feed `assertPropertyMember`/`assertPropertyHead` and are authz glue — plus all `isPropertyHead` checks and `toWireSettlement`/`toWireTransfer` (61-81).

Verify: `pnpm type-check && pnpm test:server` (Step 0 tests + `settlementGating.test.ts` prove behavior unchanged).

## Step 2 — `server/src/services/settlementPreview.ts`

Move verbatim:

| Item                                            | Current lines                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `HeadStatus`, `PreviewResult` types             | 104-126 (export both)                                                                                                                      |
| `headStatuses(db, settlementId, headsRows)`     | 251-284                                                                                                                                    |
| `computePreviewSplit(db, settlementId)`         | 286-564 (imports `listSettlementHeads` from `settlementPhase.ts`, split helpers from `settlementSplit.ts`)                                 |
| `persistClosedSplit(db, settlementId, preview)` | new name for the `acceptSplit` close transaction, 742-787 — the `ctx.db.transaction` moves into the service and returns the same `boolean` |

`acceptSplit` orchestration (acceptance insert, count vs heads, early return) stays in the router — it is interleaved with authz. Router calls `computePreviewSplit` then `persistClosedSplit`.

Verify: `pnpm type-check && pnpm test:server`. Router should now be roughly 750 lines of zod + authz + wire mapping.

## Step 3 — service-level settlement tests

`server/src/services/settlementPhase.test.ts` (DB + `withRollback`, seed like `settlementGating.test.ts`):

- `resolveSettlementParameters`: `null` policy id → all `SPLIT_POLICY_PARAMETERS`; nonexistent id → all; real policy → normalized subset.
- `advanceSettlementPhase`: CONFLICT when `from` doesn't match current phase (call twice); expense pull filters — only `submitted`, only head payers, only `settlement_id IS NULL`.
- `listSettlementHeads`: excludes non-head members and non-family groups.

## Step 4 — `server/src/services/booking.ts`

Move verbatim from `server/src/trpc/routers/booking.ts`:

| Item                                               | Current lines | Notes                        |
| -------------------------------------------------- | ------------- | ---------------------------- |
| `assertBookingsUnlocked(db, propertyId, ranges)`   | 74-113        |                              |
| `RoomCapacity`, `UserRow` types                    | 115-128       | export                       |
| `zeroBeds`                                         | 130-139       |                              |
| `AllocateRoomResult`, `allocateRoom`               | 141-226       | pure — export for unit tests |
| `resolveRoomsAndUsers(db, propertyId, occupants)`  | 228-299       |                              |
| `dedupeOccupants`                                  | 301-310       |                              |
| `ComputeBookingRoomsResult`, `computeBookingRooms` | 312-351       |                              |

Important: `OccupantInput` is currently `z.infer<typeof bookingOccupantInput>` (line 70). The service must NOT import the zod schema from the router (would invert the dependency). Define a structural type in the service — `{ user_id: number; room_id?: number | null; queued: boolean; sleeps_separately: boolean }` — the zod-inferred type is assignable to it (defaults make `queued`/`sleeps_separately` required in the output type).

Stays in the router: all zod schemas (29-68), `toWireBooking` (355-383), `loadBookings` (385-440, it's query-shape + wire mapping), the whole `previewConflicts` handler including inline `daysOverlap` (528-540, optional later extraction), the non-booker "may only remove themselves" authz block in `update` (869-916), and all `ctx.db.transaction` write blocks (781-814, 923-974, 1100-1137, 1160-1175) — write orchestration interleaves with authz and wire mapping; moving it wholesale is a follow-up, not this step.

Verify: `pnpm type-check && pnpm test:server` (`booking.test.ts` covers this router).

## Step 5 — `server/src/services/booking.test.ts`

Pure unit tests (no DB, like `settlementSplit.test.ts`) — the biggest testability win:

- `allocateRoom`: kid placement order (cot → kid bed → shared), adults refuse kid-only beds (`adultInKidOnlyUserIds` + overflow), double-bed person-slot accounting (the `Math.ceil((room.beds_double * 2 - doubleLeft) / 2)` at lines 190/216), plain overflow.
- `dedupeOccupants`: first occurrence wins.
- `computeBookingRooms`: occupants with `room_id == null` skipped; per-room overflow maps.

DB tests (`withRollback`): `resolveRoomsAndUsers` rejects a room from another property (BAD*REQUEST) and an unknown user; `assertBookingsUnlocked` passes in `collecting*\*`phases, throws in`reviewing` when ranges overlap the settlement year, passes when they don't.

## Step 6 — dedupe the triplicated queued/occupant-write blocks (small, test-protected refactor)

The identical `occupantQueued` computation appears at booking.ts:766-773 (`create`), 860-867 (`update`), 1092-1098 (`transferBooker`), and the identical occupant insert-values mapping at 801-811, 961-971, 1123-1133. Add to `services/booking.ts`:

- `computeOccupantQueued(occupants, overflowByRoom): Map<number, boolean>`
- `occupantRowValues(bookingId, occupants, occupantQueued)` returning the insert array (including the `sleeps_separately → room_id: null, queued: false` rule)

Replace the three copies. This is the only non-verbatim change in the plan; do it last, after Steps 0/5 tests pin the behavior.

## Step 7 — final verification

```
pnpm type-check
pnpm lint
pnpm test:server   # requires docker compose Postgres on :5432
pnpm test          # client suite, confirms nothing leaked into shared types
```

## Risks and mitigations

- **Transaction boundaries.** Rules: (a) every `db.transaction(...)` call moves _with_ the body that owns it today (e.g. `regressSettlementPhase`, `persistClosedSplit`) — never split a transaction across router/service; (b) helpers that today run _before_ a transaction on `ctx.db` (`assertBookingsUnlocked`, `resolveRoomsAndUsers`) keep running before it. In tests `ctx.db` is already a transaction, so service-internal `db.transaction` becomes a drizzle savepoint — this is already exercised today by `booking.test.ts` and `settlementGating.test.ts`, so no new behavior.
- **Db typing.** Use the existing `type Db = typeof dbClient` convention (as in `settlementSplit.ts`); tests pass a `Tx` through the `as unknown as Context` cast exactly as they do now.
- **Import direction.** Services must never import from `server/src/trpc/` — keep `isPropertyHead`/`assertPropertyMember` calls in routers and pass results in (already the shape of `assertCanEditBookingAdjustments(…, isHead)`). `settlementPreview.ts → settlementPhase.ts` is one-directional; no cycle.
- **TRPCError in services** deviates from `settlementSplit.ts`'s error-free style; accepted here to keep the move pure. Follow-up: domain error types mapped at the router edge.
- **Latent non-transactional advancePhase** (phase update + expense pull, settlement.ts:1183-1221): preserve as-is; fixing it changes failure semantics and belongs in its own change.
- **`computePreviewSplit` mutates the `largest` allocation in place for rounding (settlement.ts:519-521)** — move verbatim; don't "clean up" during the move.

## Critical files

- `server/src/trpc/routers/settlement.ts`
- `server/src/trpc/routers/booking.ts`
- `server/src/services/settlementSplit.ts` (convention template + imports for the preview service)
- `server/src/trpc/settlementGating.test.ts` (test harness pattern to reuse; already pins the reviewing expense-pull rule)
- `server/src/trpc/init.ts` (authz primitives that stay router-side)
