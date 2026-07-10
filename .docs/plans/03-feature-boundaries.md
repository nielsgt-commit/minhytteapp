# Plan 03 — Client feature boundaries + isomorphic-kernel lint rule

> Finding #3 in [architecture-review-2026-07-10.md](../architecture-review-2026-07-10.md).
> Status: DONE — committed 2026-07-10 as 0a66766 (all moves + barrels + lint rules; rules verified to fire via injected violations; 03-1 amendment applied: barrel invariants documented in the barrels and eslint comments, no madge dependency). 04(d) landed on top as 80d723e with its `paths` folded into these blocks per recommendations.md §4-A.

## 0. Ground truth (verified import graph)

All cross-boundary offenders found by grepping `@/features/` and `@/routes/` inside `client/src` (all use the `@/` alias; no relative `../` imports cross a feature boundary today):

| From                        | Deep import into                                                                                                     | Files                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| dashboard                   | `maintenance/due/maintenanceDue.ts`                                                                                  | `PlannedMaintenanceSummary.tsx`                                                                                                        |
| dashboard                   | `seasons/seasonUtils`                                                                                                | `PriorityWeeksPanel.tsx`, `summersummary/SummerSummary.tsx`                                                                            |
| dashboard                   | **`@/routes/_authed/administrer/-priority/priorityUtils`** (feature → routes inversion, not in the original finding) | `SummerSummary.tsx`, `PriorityWeeksPanel.tsx`, `PlannedMaintenanceSummary.tsx`, `PriorityWeekSummary.tsx`                              |
| expenses                    | `settlement/phase.ts`                                                                                                | `reviewexpenses/EmptyReviewState.tsx`, `reviewexpenses/ReviewExpenses.tsx`                                                             |
| expenses                    | `settlement/StepBadge.tsx` + `.module.css`                                                                           | `reviewexpenses/ReviewHeader.tsx`                                                                                                      |
| settlement                  | `expenses/selectors`, `expenses/types`                                                                               | `SettlementHeadsProgress.tsx`                                                                                                          |
| settlement                  | `expenses/reviewexpenses/ReviewExpenses.tsx`                                                                         | `SettlementFlow.tsx`                                                                                                                   |
| onboarding                  | `property/register/AddressLookup`, `property/structures/AddBedsFlow`                                                 | `PropertyBasicsStep.tsx`, `BedroomsStep.tsx`                                                                                           |
| planstay                    | `usergroups/groupColors`                                                                                             | `hooks/useFlatpickr.ts`, `hooks/useSingleDateFlatpickr.ts`, `staysummary/StaySummaryCompact.tsx`                                       |
| planstay                    | `seasons/seasonUtils`                                                                                                | `staysummary/StaySummaryCompact.tsx`                                                                                                   |
| property                    | `dashboard/propertyevents/PropertyEvents.tsx`                                                                        | `propertyinfo/PropertyInfo.tsx` (the **only** consumer of propertyevents anywhere — it is misplaced in dashboard)                      |
| seasons, usergroups, routes | `property/managePropertySection.module.css`                                                                          | `ManageSeasons.tsx`; `Invites.tsx`, `UserGroups.tsx`, `Users.tsx`; `routes/.../PriorityWeeks.tsx` (+5 legit in-feature property users) |
| **components/shared**       | `dashboard/MobileTabs` (`DASHBOARD_HOME_EVENT`) — shared-layer → feature inversion                                   | `BottomNavBar.tsx`                                                                                                                     |

Other facts that shape the plan:

- `settlement/phase.ts` is a **10-line pure re-export** of `@server/shared/splitPolicy.ts`; 12 client files already import `@server/shared/*` directly, so the shim adds nothing.
- `client/src/features/seasons/seasonUtils.ts` **duplicates** `isCrossYear` from `server/src/shared/season.ts`.
- `planstay/booking-logic` (the one existing barrel) is only consumed **inside** planstay — it needs no change and is compatible with the lint rule below.
- `server/src/shared/*.ts` currently imports only `temporal-polyfill`, `zod`, `superjson` (+ `vitest` in tests) — the lint rule can be strict from day one.
- ESLint 9.23 flat config at `eslint.config.js`; no import plugin installed. Core `no-restricted-imports` (with `group`/`regex` patterns, supported since 8.31) and the already-installed `@typescript-eslint/no-restricted-imports` cover everything — **no new dependency needed**.

## 1. Per-module verdicts

| Module                                                                            | Verdict                                                                                                 | Justification                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seasons/seasonUtils.ts` (+ test)                                                 | **Move to `client/src/utils/seasonUtils.ts`**                                                           | Pure Temporal date math; already depends on `@/utils/dateUtils`; consumed by 3 features + routes. While moving, delete the duplicated `isCrossYear` and re-export it from `@server/shared/season.ts` (identical implementation, structurally-compatible signature). |
| `usergroups/groupColors.ts`                                                       | **Move to `client/src/utils/groupColors.ts`**                                                           | Pure function + palette const, zero React/feature deps; its _only_ consumers are in planstay — it isn't really usergroups code.                                                                                                                                     |
| `settlement/StepBadge.tsx` + `StepBadge.module.css`                               | **Move to `components/shared/`** (flat, matching `BottomSheet.tsx` convention)                          | Presentational circled-number/check badge, no domain logic.                                                                                                                                                                                                         |
| `settlement/phase.ts`                                                             | **Delete**; consumers import `@server/shared/splitPolicy.ts` directly                                   | Domain logic already lives in the isomorphic kernel; direct `@server/shared` imports are the established pattern. Fold `phase.test.ts` cases into `server/src/shared/splitPolicy.test.ts` (which already has a "phase gating" describe — dedupe overlaps).          |
| `property/managePropertySection.module.css`                                       | **Move to `components/layouts/manageSection.module.css`**                                               | Pure layout CSS (a `.column` flex stack) used by property, seasons, usergroups, and a route; `components/layouts` (home of `AppLayout`) is the natural owner.                                                                                                       |
| `maintenance/due/maintenanceDue.ts`                                               | **Stay**; expose via new `features/maintenance/index.ts` barrel                                         | Genuine maintenance domain logic (due tokens/labels); dashboard is a legitimate consumer of maintenance's public surface.                                                                                                                                           |
| `expenses/selectors.ts`, `expenses/types.ts`, `reviewexpenses/ReviewExpenses.tsx` | **Stay**; expose via new `features/expenses/index.ts` barrel                                            | Expense domain (client row shape, review selectors, review UI). The allowed dependency direction is **settlement → expenses** (settlement is the aggregate process over expenses).                                                                                  |
| `property/register/AddressLookup.tsx`, `property/structures/AddBedsFlow.tsx`      | **Stay**; expose via new `features/property/index.ts` barrel                                            | Domain components wired to property tRPC; onboarding legitimately composes them.                                                                                                                                                                                    |
| `dashboard/propertyevents/*`                                                      | **Move to `features/property/propertyinfo/`**                                                           | Misfiled: sole consumer is `property/propertyinfo/PropertyInfo.tsx`; nothing in dashboard uses it.                                                                                                                                                                  |
| `routes/.../priorityUtils.ts`                                                     | **Move to `client/src/utils/priorityUtils.ts`**                                                         | Pure week/date/lookup helpers consumed by 4 dashboard files and 3 route files; features must never import from routes.                                                                                                                                              |
| `DASHBOARD_HOME_EVENT` (in `dashboard/MobileTabs.tsx`)                            | **Move constant to `components/shared/BottomNavBar.tsx`** (export it; MobileTabs imports it from there) | features → components is the allowed direction; components → features is not.                                                                                                                                                                                       |

**Cycle break (settlement ⇄ expenses), concretely:** the expenses→settlement edges are only `phase.ts` (becomes a direct `@server/shared/splitPolicy.ts` import) and `StepBadge` (becomes `@/components/shared/StepBadge`). After that, all remaining edges point settlement → expenses, served by the new expenses barrel. Nothing moves out of expenses.

## 2. Exact moves (old → new)

```
client/src/features/settlement/StepBadge.tsx              → client/src/components/shared/StepBadge.tsx
client/src/features/settlement/StepBadge.module.css       → client/src/components/shared/StepBadge.module.css
client/src/features/settlement/phase.ts                   → (delete; import @server/shared/splitPolicy.ts)
client/src/features/settlement/phase.test.ts              → merge into server/src/shared/splitPolicy.test.ts, then delete
client/src/features/seasons/seasonUtils.ts                → client/src/utils/seasonUtils.ts
client/src/features/seasons/seasonUtils.test.ts           → client/src/utils/seasonUtils.test.ts
client/src/features/usergroups/groupColors.ts             → client/src/utils/groupColors.ts
client/src/routes/_authed/administrer/-priority/priorityUtils.ts
                                                          → client/src/utils/priorityUtils.ts
client/src/features/property/managePropertySection.module.css
                                                          → client/src/components/layouts/manageSection.module.css
client/src/features/dashboard/propertyevents/PropertyEvents.tsx
                                                          → client/src/features/property/propertyinfo/PropertyEvents.tsx
client/src/features/dashboard/propertyevents/PropertyEvents.module.css
                                                          → client/src/features/property/propertyinfo/PropertyEvents.module.css
DASHBOARD_HOME_EVENT const                                → exported from client/src/components/shared/BottomNavBar.tsx
```

New files (public barrels):

- `client/src/features/expenses/index.ts` — export `ReviewExpenses` (from `./reviewexpenses/ReviewExpenses.tsx`), `selectExpensesToReview`, `selectMyExpenses` (from `./selectors.ts`), `type ExpenseRow`, `type Status`, `type ExpenseType` (from `./types.ts`).
- `client/src/features/maintenance/index.ts` — export the `maintenanceDue.ts` symbols dashboard consumes (per `PlannedMaintenanceSummary.tsx`'s two import groups; implementer copies the exact names, e.g. `dueToToken`/`tokenToDue`/`staticDueKindLabel`/`priorityGroupLabel` + types).
- `client/src/features/property/index.ts` — export `AddressLookup`, `type GeonorgeAddress` (from `./register/AddressLookup.tsx`), `AddBedsFlow`, `type RoomData` (from `./structures/AddBedsFlow.tsx`).

Barrel style: follow the documented-surface pattern of `client/src/features/planstay/booking-logic/index.ts` (comment header listing the surface, explicit named re-exports, `.ts`/`.tsx` extensions). Directory imports (`@/features/expenses`) resolve fine — booking-logic is imported that way already.

## 3. Migration order (each step independently keeps `tsc -b --noEmit` green)

Each step = move file(s) + mechanically update importers (find-and-replace of the module specifier), then `pnpm type-check`.

1. **StepBadge → components/shared.** Update 5 importers (`expenses/reviewexpenses/ReviewHeader.tsx` — both `.tsx` and `.module.css` imports; `settlement/SettlementIntro.tsx`, `reviewsettlement/ReviewSettlement.tsx`, `reviewsettlement/ReviewBookingDays.tsx`, `reviewsplitpolicy/ReviewSplitPolicy.tsx`) to `@/components/shared/StepBadge`.
2. **Delete `settlement/phase.ts`.** Rewrite its 10 importers (2 in expenses, 8 in settlement — `SettlementFlow`, `SettlementIntro`, `SettlementHeadsProgress`, `SettlementProgressSummary`, `SettlementPhaseStepper`, `reviewsettlement/*` ×2, `reviewsplitpolicy/ReviewSplitPolicy`) to `@server/shared/splitPolicy.ts`, same named imports. Fold `phase.test.ts` describes into `server/src/shared/splitPolicy.test.ts` (skip duplicates already covered by its "phase gating" block). **This step alone breaks the expenses→settlement half of the cycle** (together with step 1).
3. **seasonUtils → `client/src/utils/`.** Update 6 importers (seasons ×2, dashboard ×2, planstay ×1, routes/-priority ×2 — note `PriorityWeeksTable.tsx` and `PriorityWeeks.tsx`) plus the test's relative import. Replace the local `isCrossYear` with `export { isCrossYear } from "@server/shared/season.ts"`.
4. **groupColors → `client/src/utils/`.** Update 3 planstay importers.
5. **priorityUtils → `client/src/utils/`.** Update 4 dashboard + 3 route importers (`PriorityWeekRow.tsx`, `PriorityWeeksTable.tsx`, `PriorityWeeks.tsx`).
6. **managePropertySection.module.css → `components/layouts/manageSection.module.css`.** Update 10 importers (property ×5, usergroups ×3, seasons ×1, routes ×1).
7. **propertyevents → property/propertyinfo.** Update `PropertyInfo.tsx` to a relative import; delete the empty `features/dashboard/propertyevents/` dir.
8. **DASHBOARD_HOME_EVENT → BottomNavBar.tsx.** Export it there; `dashboard/MobileTabs.tsx` imports it from `@/components/shared/BottomNavBar`.
9. **Create the three barrels** and switch the remaining cross-feature consumers to them: `settlement/SettlementHeadsProgress.tsx` and `settlement/SettlementFlow.tsx` → `@/features/expenses`; `dashboard/.../PlannedMaintenanceSummary.tsx` → `@/features/maintenance`; `onboarding/PropertyBasicsStep.tsx` and `onboarding/BedroomsStep.tsx` → `@/features/property`. (Barrels last so every step before them compiles without new files depending on later moves.)
10. **Add the ESLint boundary rules** (below); `pnpm lint` must be clean — it is the proof the graph is fixed.

Steps 1–8 are order-independent of each other; the given order does the cycle-critical work first.

## 4. ESLint enforcement (flat config, no new plugin)

Add to `eslint.config.js`:

```js
import { readdirSync } from "node:fs"
import path from "node:path"

const FEATURES = readdirSync(
  path.join(import.meta.dirname, "client/src/features"),
)
```

**(a) Cross-feature deep imports (client)** — one generated block per feature; barrel imports (`@/features/x`) stay legal, deep imports (`@/features/x/anything`) are only legal inside `x` itself:

```js
...FEATURES.map(feature => ({
  name: `feature-boundaries/${feature}`,
  files: [`client/src/features/${feature}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      2,
      {
        patterns: [
          {
            group: ["@/features/*/**", `!@/features/${feature}/**`],
            message:
              "Deep import into another feature. Import its public barrel instead: @/features/<name>.",
          },
          {
            group: ["@/routes/**"],
            message:
              "Features must not import from routes. Move shared code to @/utils or @/components.",
          },
        ],
      },
    ],
  },
})),
```

Plus a shared-components layering block:

```js
{
  name: "components-are-feature-free",
  files: ["client/src/components/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      2,
      {
        patterns: [
          {
            group: ["@/features/**", "@/routes/**"],
            message: "Shared components must not depend on features or routes.",
          },
        ],
      },
    ],
  },
},
```

**(b) Isomorphic kernel (`server/src/shared`)** — allowlist via the `regex` pattern form (supported in ESLint ≥8.31; repo has 9.23):

```js
{
  name: "isomorphic-shared-kernel",
  files: ["server/src/shared/**/*.ts"],
  ignores: ["server/src/shared/**/*.test.ts"],
  rules: {
    "no-restricted-imports": [
      2,
      {
        patterns: [
          {
            regex: "^(?!\\./|temporal-polyfill$|zod$|superjson$).",
            message:
              "server/src/shared is the isomorphic kernel shared with the browser: only temporal-polyfill, zod, superjson, and sibling ./ imports are allowed (no node:*, pg, drizzle, or other server code).",
          },
        ],
      },
    ],
  },
},
{
  name: "isomorphic-shared-kernel-tests",
  files: ["server/src/shared/**/*.test.ts"],
  rules: {
    "no-restricted-imports": [
      2,
      {
        patterns: [
          {
            regex: "^(?!\\./|temporal-polyfill$|zod$|superjson$|vitest$).",
            message: "Shared-kernel tests may additionally import only vitest.",
          },
        ],
      },
    ],
  },
},
```

**(c) Bonus, recommended: client → server boundary** — client may import runtime values only from `@server/shared`; type-only imports (the `AppRouter` type in `client/src/trpc/client.ts`) stay legal via `allowTypeImports`:

```js
{
  name: "client-server-boundary",
  files: ["client/src/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-restricted-imports": [
      2,
      {
        patterns: [
          {
            group: ["@server/*", "!@server/shared", "!@server/shared/**"],
            allowTypeImports: true,
            message:
              "Client code may import runtime values only from @server/shared (type-only imports are fine anywhere).",
          },
        ],
      },
    ],
  },
},
```

Known limitations to document in the config comments: (1) the `group` patterns match import _specifiers_, so a relative `../../otherfeature/...` escape would bypass rule (a) — none exist today (verified), and the verification grep below catches regressions; if that ever becomes a problem, switch rule (a) to `eslint-plugin-boundaries`, which resolves real paths. (2) Insert these blocks before `prettierConfig` and note that `tests-relaxed` does not touch these rules, so they apply to tests too.

## 5. Verification

1. `pnpm type-check` after every step; `pnpm lint` after step 10 (zero `no-restricted-imports` errors, zero unused-disable directives).
2. `pnpm test` (client vitest) and `pnpm test:server` — the moved `seasonUtils.test.ts` must still be picked up by the client config, and the merged phase cases by `server/vitest.config.ts` (`include: src/**/*.test.ts` — covered).
3. Graph audit: re-run the offender grep from section 0 (`grep -rn "@/features/[a-z]*/" client/src/features`, filtered to cross-feature hits) — should output nothing except barrel imports; and `grep -rn "@/routes" client/src/features client/src/components`.
4. Negative lint test: temporarily add `import "node:fs"` to `server/src/shared/season.ts` and a `@/features/settlement/StepBadge`-style deep import to an expenses file — both must fail lint — then revert.
5. Manual smoke (areas touched by CSS/component moves): Manage Property sections + Manage Seasons + User Groups pages (shared column CSS), settlement flow intro/review steps (StepBadge), expenses review header, dashboard planned-maintenance and priority-weeks panels, planstay calendar (group colors, season windows), onboarding address/beds steps, Property Info page (PropertyEvents), mobile bottom nav "home" tab re-tap (DASHBOARD_HOME_EVENT).

## Critical files

- `eslint.config.js`
- `client/src/features/settlement/phase.ts`
- `client/src/features/settlement/SettlementHeadsProgress.tsx`
- `client/src/features/seasons/seasonUtils.ts`
- `client/src/features/planstay/booking-logic/index.ts` (barrel pattern to copy)
