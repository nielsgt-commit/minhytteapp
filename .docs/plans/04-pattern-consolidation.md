# Plan 04 — Pattern consolidation (toWire factory, category hooks, head gates, mutation convention)

> Finding #4 in [architecture-review-2026-07-10.md](../architecture-review-2026-07-10.md).
> Status: (a), (c), (b) DONE — committed 2026-07-10 as c1f3bd1 (wireMap; guard caught a real leak: season mutations shipped created_at/updated_at as raw Dates — fixed with a full-row variant; point-free `.map(toWireX)` needed lambda wrapping), 23f8cf7 (head gates; propertyHeadOrAdminProcedure renamed propertyHeadProcedure), d503a5d (category hooks; deviation: shared core `hooks/useCategorySuggestions` takes injected mutate fns instead of the plan's UseMutationOptions injection — sidesteps tRPC error-type variance). **(d) DONE** — committed 80d723e after plan 03 (0a66766): `RESTRICTED_CLIENT_IMPORT_PATHS` rides inside the per-feature and components boundary blocks plus a client-wide block; 4 sanctioned files carry inline disables; README documents the convention with 04-1's corrected reasons and 04-2's known-limitation line.

Recommended execution order (value/risk ratio, best first): **(a) wireMap factory → (c) head-gate consolidation → (b) category-mutations dedup → (d) mutation-convention (doc + lint only, no sweep)**. Each item is independently shippable; do them as four separate commits/PRs in that order.

**Correction to the finding:** the review's "~50/50, 44 vs 47 sites" claim for (d) is stale. Measured 2026-07-10: **119** `useMutationWithInvalidation(` call sites vs **5** raw `useMutation(` call sites (in 4 files), and each raw site is deliberate (optimistic updates, ordered post-success navigation, or shared cross-mutation invalidation). The convention is already ~96% unified, so (d) becomes a cheap "codify + guard" task, not a sweep.

---

## (a) `wireMap` factory for toWire converters

### Current state (enumerated by grep — 19 converters in 18 files)

| File                                | Converter                                                   | Spec                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `routers/parking.ts:15`             | `toWireClaim`                                               | `claimed_at: instant`                                                                                               |
| `routers/inspection.ts:41`          | `toWireInspection`                                          | `started_at: instant, completed_at: instantOrNull`                                                                  |
| `routers/season.ts:14`              | `toWireSeason`                                              | `archived_at: instantOrNull`                                                                                        |
| `routers/procedureStep.ts:27`       | `toWireProcedureStep` (exported, imported by inspection.ts) | `created_at: instant, archived_at: instantOrNull`                                                                   |
| `routers/expenseCategory.ts:16`     | `toWireCategory`                                            | `archived_at: instantOrNull`                                                                                        |
| `routers/expense.ts:28`             | `toWireExpense`                                             | `date: plainDate, receipt_date: plainDate`                                                                          |
| `routers/propertySplitPolicy.ts:21` | `toWirePolicy`                                              | `created_at: instant, updated_at: instant`                                                                          |
| `routers/allowedEmail.ts:27`        | `toWireInvite`                                              | `used_at: instantOrNull, created_at: instant`                                                                       |
| `routers/propertyContact.ts:9`      | `toWireContact`                                             | `created_at: instant, updated_at: instant`                                                                          |
| `routers/user.ts:40`                | `toWireUser`                                                | `birthday: plainDateOrNull, onboarding_dismissed_at: instantOrNull, created_at: instant, updated_at: instant`       |
| `routers/settlement.ts:61,77`       | `toWireSettlement`, `toWireTransfer`                        | `opened_at: instant, closed_at: instantOrNull`; `paid_at: instantOrNull`                                            |
| `routers/maintenance.ts:31`         | `toWireMaintenance` (exported, imported by inspection.ts)   | `due_at: instantOrNull, created_at: instant, completed_at: instantOrNull`                                           |
| `routers/equipmentCategory.ts:13`   | `toWireCategory`                                            | `archived_at: instantOrNull`                                                                                        |
| `routers/dinner.ts:15`              | `toWireDinner`                                              | `date: plainDate, created_at: instant`                                                                              |
| `routers/todo.ts:22`                | `toWireTodo`                                                | `created_at: instant`                                                                                               |
| `routers/equipment.ts:15`           | `toWireEquipment`                                           | `created_at: instant`                                                                                               |
| `routers/booking.ts:355`            | `toWireBooking`                                             | `start_date: plainDate, end_date: plainDate, created_at: instant, updated_at: instant, cancelled_at: instantOrNull` |
| `routers/shoppingItem.ts:15`        | `toWireShoppingItem`                                        | `created_at: instant`                                                                                               |

Only 4 conversion kinds exist, exactly matching the four helpers in `server/src/shared/temporal.ts` (`instantFromDate`, `instantFromDateOrNull`, `plainDateFromDb`, `plainDateFromDbOrNull`). No converter does anything else. This makes a spec-driven factory a perfect fit.

### New abstraction

New file `server/src/trpc/util/wire.ts` (the `trpc/util/` dir already exists with `propertyAccess.ts`; do **not** put it in `shared/temporal.ts`, which is isomorphic and deliberately minimal — the factory is server-edge-only):

```ts
import {
  type Temporal,
  instantFromDate,
  instantFromDateOrNull,
  plainDateFromDb,
  plainDateFromDbOrNull,
} from "../../shared/temporal.ts"

const converters = {
  instant: instantFromDate,
  instantOrNull: instantFromDateOrNull,
  plainDate: plainDateFromDb,
  plainDateOrNull: plainDateFromDbOrNull,
} as const

type WireKind = keyof typeof converters

type WireIn = {
  instant: Date
  instantOrNull: Date | null
  plainDate: string
  plainDateOrNull: string | null
}
type WireOut = {
  instant: Temporal.Instant
  instantOrNull: Temporal.Instant | null
  plainDate: Temporal.PlainDate
  plainDateOrNull: Temporal.PlainDate | null
}

// Keys of T that still hold a raw JS Date (the bug class this factory kills).
type DateKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends Date ? K : never
}[keyof T]

export function wireMap<S extends Record<string, WireKind>>(spec: S) {
  return function toWire<T extends { [K in keyof S]: WireIn[S[K]] }>(
    // Second intersection member rejects rows with Date columns not in the
    // spec: a forgotten timestamp is now a COMPILE error, not a silent raw
    // Date on the wire.
    row: T &
      ([Exclude<DateKeys<T>, keyof S>] extends [never]
        ? unknown
        : {
            "ERROR: unmapped Date column(s)": Exclude<DateKeys<T>, keyof S>
          }),
  ): Omit<T, keyof S> & { [K in keyof S]: WireOut[S[K]] } {
    const out: Record<string, unknown> = { ...row }
    for (const key of Object.keys(spec)) {
      out[key] = (converters[spec[key]] as (v: unknown) => unknown)(
        (row as Record<string, unknown>)[key],
      )
    }
    return out as Omit<T, keyof S> & { [K in keyof S]: WireOut[S[K]] }
  }
}
```

Usage (settlement example — call sites do not change):

```ts
const toWireSettlement = wireMap({
  opened_at: "instant",
  closed_at: "instantOrNull",
})
const toWireTransfer = wireMap({ paid_at: "instantOrNull" })
```

### Type-safety assessment

Full safety is achievable for the **Date** side of the problem: the `DateKeys` guard makes "forgot to list a timestamp column" a compile error, which is exactly the failure mode the review flagged. Two pragmatic limits to document in the file header:

1. **`plainDate` string columns cannot be guarded** — a `"YYYY-MM-DD"` string is indistinguishable from any other `string` at the type level, so a forgotten date-string column still ships as a string. Acceptable: raw strings do not violate the superjson/transformer wire contract the way `Date` does, and date columns are rare and conventionally named (`date`, `*_date`, `birthday`).
2. **Nullability is one-directional**: marking a NOT NULL `Date` column as `instantOrNull` type-checks (the column satisfies `Date | null`) and widens the output to `| null`. The reverse (nullable column marked `instant`) correctly fails. This matches the precision of the hand-written converters closely enough; don't chase exactness with `Extract<...> extends never` tricks — they degrade error messages.

Verify the guard actually fires before migrating: write `server/src/trpc/util/wire.test.ts` with runtime cases (each kind, null passthrough, untouched keys) plus `// @ts-expect-error` cases for (i) an unmapped `Date` column and (ii) a spec key missing from the row.

### Migration order

Mechanical, one commit is fine, but do it in this order so the guard is proven before wide rollout:

1. Add `wire.ts` + `wire.test.ts`; `pnpm test:server`.
2. Single-key routers first (todo, equipment, shoppingItem, parking, season, equipmentCategory, expenseCategory) — replace each `function toWire*` with `const toWire* = wireMap({...})`, keep the local const name, delete now-unused `temporal.ts` imports.
3. Multi-key routers (inspection, propertySplitPolicy, allowedEmail, propertyContact, dinner, expense, settlement, user, booking).
4. The two **exported** converters last (`toWireProcedureStep`, `toWireMaintenance`) — keep them exported as `export const toWireProcedureStep = wireMap({...})`; `inspection.ts`'s imports keep working unchanged.
5. Verification: `pnpm type-check` (this is the real test — every router's inferred output type must be unchanged; any drift shows up as client compile errors since the client consumes the inferred `AppRouter` types), then `pnpm test:server`, `pnpm test`, `pnpm lint`.

Risk: low. ~19 mechanical replacements, no runtime behavior change, and the type-checker verifies output-shape equivalence end-to-end.

---

## (c) Head-gate consolidation (settlement + priority)

### Ground truth on semantics (the names are misleading)

In `server/src/trpc/init.ts`:

- `isPropertyHead` (line 44) — **strict**: real head of a family group on the property; platform admin does NOT satisfy it (documented, tested in `authorization.test.ts:175`).
- `assertPropertyHead` (line 74) — strict head or throw; error message wrongly says _"head or admin role required for this property"_.
- `assertPropertyHeadOrAdmin` (line 92) — admin bypass, else strict head. Used by `allowedEmail.ts`.
- `propertyAdminProcedure` (line 127) — misnomer: it asserts **membership** (`assertPropertyMember`, which lets platform admins through).
- `propertyHeadOrAdminProcedure` (line 134) — misnomer: it calls `assertPropertyHead`, i.e. it is a **strict-head** gate; admins do NOT pass. Used by season/expenseCategory/equipmentCategory create/rename/archive.

### Enumeration of hand-rolled head gates

**True gates to consolidate** (all express strict-head as `assertPropertyMember` + `if (!isPropertyHead) throw`; since a strict head is always a member and the member check admits admins who then fail the head check anyway, the allow/deny set of the pair is exactly `assertPropertyHead` — only error messages differ):

| Site                                                   | Current expression                                                  | Custom message                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `settlement.ts` `acceptSplit` (:685)                   | inline `isPropertyHead` + throw, then `assertPropertyMember` (:705) | "only heads can accept the split"                                                                          |
| `settlement.ts` `setReviewDone` (:824–830)             | member + inline head throw                                          | "only heads can update review progress"                                                                    |
| `settlement.ts` `markTransferPaid` (:1086, :1105–1110) | member + inline head throw                                          | "only heads can mark transfers paid"                                                                       |
| `settlement.ts` `advancePhase` (:1158–1164)            | member + inline head throw                                          | "only heads can advance settlement phase"                                                                  |
| `settlement.ts` `regressPhase` (:1235–1241)            | member + inline head throw                                          | "only heads can regress settlement phase"                                                                  |
| `priority.ts` `ensureCanEdit` (:51–61)                 | `if (user.is_admin) return` + inline head throw                     | "must be a household head to edit priority weeks" — this one is **headOrAdmin** semantics, not strict head |

**NOT gates — leave alone** (head status used as data/capability, not authorization):

- `settlement.ts:903, :944` — `isPropertyHead` result passed into `assertCanEditBookingAdjustments`.
- `settlement.ts:1013` — `canMarkAnyPaid` capability flag in `getClosedSummary` response.
- `expense.ts:66` — head status feeds a policy function.
- `settlement.ts:652` (`delete`) — already uses `assertPropertyHead`; canonical.
- The secondary `listSettlementHeads`/`heads.some(...)` checks in acceptSplit (:707–713) and setReviewDone (:832–838) — redundant with the head gate in practice, but they gate against a _different computed set_ (settlement heads). Do not remove in this change; semantics-preservation is the rule.

`advancePhase`/`regressPhase` **cannot** move onto `propertyHeadOrAdminProcedure`: that procedure requires `property_id` in the input, but these take a settlement `id` and resolve the property from the DB. Helper-based consolidation is the right target.

### Steps

1. **Extend `assertPropertyHead` with an optional message** in `server/src/trpc/init.ts`, and fix its lying default message:

```ts
export async function assertPropertyHead(
  db: Db,
  user: AuthUser,
  propertyId: number,
  message = "must be a household head of this property",
) {
  if (!(await isPropertyHead(db, user, propertyId))) {
    throw new TRPCError({ code: "FORBIDDEN", message })
  }
}
```

Thread the same optional message through `assertPropertyHeadOrAdmin`. 2. **settlement.ts**: at the five sites above, delete the `assertPropertyMember` + inline `isPropertyHead`/throw pair and replace with one `await assertPropertyHead(ctx.db, ctx.user, propertyId, "<existing custom message>")`. In `acceptSplit`, replace the :685 inline block and the now-redundant :705 `assertPropertyMember` (the null-property guard at :698 stays; the head check now runs after the resolve-equivalent null handling exactly as before). Keep the `isPropertyHead` import — the capability-flag sites (:903, :944, :1013) still use it. 3. **priority.ts** `ensureCanEdit`: reimplement as `await assertPropertyHeadOrAdmin(db, user, propertyId, "must be a household head to edit priority weeks")` — identical semantics (admin bypass documented at the site). 4. **Naming cleanup (optional, same PR, zero behavior change)**: rename `propertyHeadOrAdminProcedure` → `propertyHeadProcedure` in `init.ts` and its ~10 usages (`season.ts`, `expenseCategory.ts`, `equipmentCategory.ts`), since it enforces strict head. If those routers _intended_ headOrAdmin, that is a semantic decision for a separate change — flag it, don't fix it here. 5. **Tests**: extend `settlementGating.test.ts` / `authorization.test.ts` — assert a non-member platform admin is still refused by `advancePhase`-style gates (guards the deliberate strict-head distinction) and that custom messages survive. Run `pnpm test:server`, `pnpm type-check`.

Risk: low-medium (auth code), mitigated by the pair→single equivalence argument above and existing authz tests. Diff is small (~60 lines removed).

---

## (b) Category-mutations hook dedup (+ server router assessment)

### Client hook

The two hooks are byte-identical except for the tRPC namespace (`trpc.expenseCategory.*` vs `trpc.equipmentCategory.*`). Rather than fighting the tRPC proxy's structural types with a generic "namespace" parameter (the `mutationOptions`/`queryKey` proxy types are gnarly to abstract over), inject the three prebuilt pieces:

New file `client/src/hooks/useCategorySuggestionMutations.ts` (lives in the shared `hooks/` dir because both `features/expenses/` and `features/property/` consume it):

```ts
import type { QueryKey, UseMutationOptions } from "@tanstack/react-query"

type Category = { id: number; name: string }

type CategoryEndpoints = {
  listQueryKey: QueryKey
  createOptions: UseMutationOptions<
    unknown,
    Error,
    { property_id: number; name: string }
  >
  archiveOptions: UseMutationOptions<
    unknown,
    Error,
    { property_id: number; id: number }
  >
}

export function useCategorySuggestionMutations(
  categories: Category[],
  suggestionInputRef: RefObject<HTMLInputElement | null>,
  propertyId: number | null,
  endpoints: CategoryEndpoints,
) {
  // …entire existing body, with categoryKey = [endpoints.listQueryKey] and
  // the two useMutationWithInvalidation calls fed endpoints.createOptions /
  // endpoints.archiveOptions…
  return { selectedCats, handleCategoriesChange, status }
}
```

Keep the two existing hooks as ~12-line wrappers so the call sites (`features/expenses/categories/ManageCategories.tsx:36`, `features/property/equipment/ManageEquipmentCategories.tsx:25`) are untouched:

```ts
// features/expenses/expenseform/useCategoryMutations.ts
export function useCategoryMutations(categories, ref, propertyId) {
  const trpc = useTRPC()
  return useCategorySuggestionMutations(categories, ref, propertyId, {
    listQueryKey: trpc.expenseCategory.list.queryKey({
      property_id: propertyId ?? 0,
    }),
    createOptions: trpc.expenseCategory.create.mutationOptions(),
    archiveOptions: trpc.expenseCategory.archive.mutationOptions(),
  })
}
```

Same shape for `useEquipmentCategoryMutations`. The `UseMutationOptions<unknown, Error, …>` variables-typing is the one place needing care: the tRPC-generated options are covariant in variables here (both mutations accept exactly `{property_id, name}` / `{property_id, id}` per the routers), so this assigns cleanly; if TS balks on the data type, widen `TData` to `unknown` at the shared-hook boundary — the hook never reads mutation data.

Migration: 1 new file, 2 files shrink to wrappers, 0 call-site changes. Verify with `pnpm type-check`, `pnpm test`, and a manual pass through both Suggestion UIs (`pnpm dev:all`).

### Server routers: do NOT factory them

Assessment after reading both: `equipmentCategory.ts` (66 lines: list/create/archive) vs `expenseCategory.ts` (147 lines: list/**listAllForDisplay**/create/**rename** — with a transactional cascade rewriting `expensesTable.expense_types` via `array_replace` — /archive/**unarchive**, and a different name max-length, 64 vs 32). Only 3 of 6 procedures overlap, and the shared part is ~60 trivial lines. A router factory would need parameters for table, name length, and extension procedures — more abstraction than duplication removed, and it would couple two independently-evolving domains (expense categories are clearly still growing). **Keep them separate**; their duplicated `toWireCategory` is already eliminated by item (a) (`wireMap({ archived_at: "instantOrNull" })`). Optionally note this decision in a comment atop `equipmentCategory.ts` replacing the "mirror" apology.

---

## (d) Mutation-convention unification — verdict: no sweep; codify + lint-guard

### Measured reality (2026-07-10)

- `useMutationWithInvalidation(` call sites: **119** (in 50 files).
- Raw `useMutation(`: **5 call sites in 4 files**, each with a structural reason the wrapper cannot express:
  - `features/dashboard/capacitysummary/availableparking/useParking.ts` (2) — full optimistic-update lifecycle (`onMutate`/rollback/`onSettled`).
  - `features/property/dangerzone/DeletePropertyFlow.tsx` (1) — invalidation must complete **before** navigation/selection-clear, an ordering the wrapper's parallel-invalidate-then-onSuccess happens to allow but that reads clearer explicit.
  - `features/planstay/hooks/useBookingForm.ts` (2) — one shared `pathKey()`-wide invalidation after whichever of create/update ran, inside a `useActionState` flow.

Unifying the last 5 sites would force the wrapper to grow optimistic-update and ordering options — churn with negative payoff.

### Steps (small, ~1 hour)

1. **Convention doc**: add a "Mutations" section to the repo's contributor docs stating: _default to `useMutationWithInvalidation(options, keys)`; drop to raw `useMutation` only for optimistic updates or when success-ordering matters, and say why in a comment._
2. **Lint guard**: in `eslint.config.js` (flat config, main block), add `no-restricted-imports` for the raw hook:

```js
"no-restricted-imports": ["error", {
  paths: [{
    name: "@tanstack/react-query",
    importNames: ["useMutation"],
    message: "Default to useMutationWithInvalidation (@/hooks/useMutationWithInvalidation); raw useMutation only for optimistic updates — disable this rule inline with a justification.",
  }],
}],
```

Add `// eslint-disable-next-line no-restricted-imports -- <reason>` at the 4 sanctioned files (plus `hooks/useMutationWithInvalidation.ts` itself and the 3 test files that import it: `ChildrenSection.test.tsx`, `UserSettings.test.tsx`, `ProfileSection.test.tsx` — or scope the rule to exclude `**/*.test.*`). 3. Verify: `pnpm lint` (expect exactly the sanctioned disables), `pnpm type-check`, `pnpm test`.

Risk: near zero; no runtime code changes.

---

## Global verification per item

Each item independently: `pnpm type-check` → `pnpm lint` → `pnpm test` (client vitest) → `pnpm test:server`. Item (a) additionally relies on `pnpm type-check` as the equivalence proof (router output types are consumed by the client via inference, so any wire-shape drift fails the build). Item (c) additionally needs the new authz test cases green.

## Critical files

- `server/src/trpc/init.ts`
- `server/src/trpc/routers/settlement.ts`
- `server/src/shared/temporal.ts` (read-only reference for the new `server/src/trpc/util/wire.ts`)
- `client/src/hooks/useMutationWithInvalidation.ts`
- `client/src/features/expenses/expenseform/useCategoryMutations.ts`
