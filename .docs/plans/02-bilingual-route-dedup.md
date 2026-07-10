# Plan 02 — Collapse duplicated EN/NB routes into one canonical route tree with URL rewriting

> Finding #2 in [architecture-review-2026-07-10.md](../architecture-review-2026-07-10.md).
> Status: DONE — executed 2026-07-10, commit 9245be0. Step 6 folded into the initial table. One deviation: the step-3 `navigate({ to: "." })` re-commit was deduped by the router one way (user-observed), so `useSwitchLocale` computes the public href itself and writes it via `router.history.replace()` — the plan's anticipated fallback. User smoke-tested both switch directions.

## What the code actually looks like (findings that reshape the premise)

1. **Only the 9 top-level pairs are true duplicates.** `todos/oppgaver`, `settlement/oppgjor`, `dashboard/oversikt`, `expenses/utlegg`, `maintenance/vedlikehold`, `shoppinglist/handleliste`, `usersettings/innstillinger`, `planstay/planleggopphold`, and the `manageproperty.tsx`/`administrer.tsx` layout are identical modulo the `createFileRoute` id string (verified by diff).
2. **The `manageproperty/*` subtree is NOT duplicated — it is already 13 redirect stubs.** Every child (`users.tsx`, `usergroups.tsx`, `invites.tsx`, `info.tsx`, `contacts.tsx`, `ownership.tsx`, `structures.tsx`, `infrastructure.tsx`, `equipment.tsx`, `settings.tsx`, `split-policy.tsx`, `priority.tsx`, `index.tsx`) contains only `beforeLoad: () => { throw redirect({ to: "/administrer/..." }) }`. The repo has already de facto made Norwegian canonical for admin; newer admin pages (`sesonger`, `utgiftskategorier`, `prioritet`, the `fordelingspolicy` subtree) exist **only** in NB.
3. **All internal navigation already uses NB paths** (`BottomNavBar`, `NavTabs`, `PropertyMenu`, `UserMenu`, `MobileTabs`, `OnboardingFlow`, `ManageProperty` sidebar, `_marketing/index.tsx` redirect) — except two strays: `features/home/UnauthenticatedView.tsx:35` (`callbackURL: "/dashboard"`) and `routes/_onboarding/onboarding.tsx:25` (`redirect({ to: "/dashboard" })`).
4. **`routeEquivalents.ts` has exactly one consumer**: `useSwitchLocale` in `hooks/useLocalizedNavigate.ts`, used by `LanguageSwitcher.tsx`. Its `/manageproperty` and `/manageproperty/invites` EN entries are already no-ops (the EN targets redirect straight back to NB).
5. **The installed router supports first-class URL rewriting.** `@tanstack/react-router` 1.168 / `router-core` 1.168.15 ships `createRouter({ rewrite: { input, output } })` (`LocationRewrite` in `router.d.ts:355-380`), and TanStack's own docs list "i18n locale prefixes / localized paths without duplicating routes" as the primary use case.
6. **Constraint on the shared `-page.ts` option:** the router plugin's auto code splitter iterates `routeOptions.properties` and skips anything that is not an `ObjectProperty` (`if (!t.isObjectProperty(prop)) continue;` in `router-plugin/dist/esm/core/code-splitter/compilers.js:165-184`). Spreading a shared options object into `createFileRoute(...)({ ...page })` would **silently disable code splitting** for all 18 route files, pulling every feature component into the eager bundle (`autoCodeSplitting: true` is set in `client/vite.config.ts:11`).
7. `validateSearch`/`retainSearchParams` exist only on `/_authed` (`selectionSearchSchema`, `retainSearchParams(["property","user"])`) and `/onboarding` — nothing on the duplicated leaves, so a pathname-only transformation cannot break them.

## Option analysis — pick Option C (single canonical tree + `rewrite`)

- **Option A — shared `-pages/*.ts` modules spread into both `createFileRoute` calls.** Rejected. Finding 6 means the idiomatic version regresses bundle size for 9 pages; the safe variant (share only the loader, keep `component:` inline in both files) leaves exactly the wiring duplication the review targets, keeps 18 route files, keeps the doubled `routeTree.gen.ts`, and keeps `routeEquivalents.ts` hand-maintained. It also does nothing about the admin-subtree asymmetry.
- **Option B — delete EN routes, keep redirect stubs.** Consistent with what the admin subtree already does and dead simple, but it violates the stated goal: the browser would always show NB URLs, so "keep the localized URLs" fails. Kept as the fallback if the rewrite smoke test fails.
- **Option C — one canonical (NB) route tree + `rewrite: { input, output }`.** Chosen. NB is the obvious canonical language (all internal links are NB; NB-only pages already exist). EN URLs remain fully functional as deep links **and** stay in the address bar for EN users. Duplication drops to zero route files: one table line per page instead of two files. `routeEquivalents.ts` becomes the single source of truth _driving_ the router instead of a parallel map reconciling it. Code splitting, `validateSearch`, and `retainSearchParams` are untouched (rewrite only edits `url.pathname`; `?property=&user=` passes through). Bonus: EN admin URLs (`/manageproperty/invites` etc.) become real localized aliases again instead of redirects that snap back to NB.

## Before / after sketch (todos/oppgaver)

**Before** — two files, hand-synced:

```ts
// routes/_authed/todos.tsx  AND  routes/_authed/oppgaver.tsx (identical bodies)
export const Route = createFileRoute("/_authed/todos")({
  // or "/_authed/oppgaver"
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.todo.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: Todos,
})
```

plus two entries in `ROUTE_EQUIVALENTS`.

**After** — `todos.tsx` is deleted; `oppgaver.tsx` is byte-for-byte unchanged (loader/component untouched, so auto code splitting still works); the pair becomes one line of data:

```ts
// client/src/i18n/localizedPaths.ts  (replaces routeEquivalents.ts)
// Ordered longest-prefix-first; matching is on whole path segments.
export const LOCALIZED_PATHS: ReadonlyArray<readonly [nb: string, en: string]> =
  [
    ["/administrer/invitasjoner", "/manageproperty/invites"],
    // ...other admin children...
    ["/administrer", "/manageproperty"],
    ["/oppgaver", "/todos"],
    ["/oversikt", "/dashboard"],
    ["/planleggopphold", "/planstay"],
    ["/utlegg", "/expenses"],
    ["/vedlikehold", "/maintenance"],
    ["/oppgjor", "/settlement"],
    ["/handleliste", "/shoppinglist"],
    ["/innstillinger", "/usersettings"],
  ]

export function toCanonicalPath(pathname: string): string // en -> nb, longest segment-boundary prefix swap
export function toPublicPath(pathname: string, locale: "en" | "nb"): string // nb -> en when locale === "en"
```

```ts
// client/src/main.tsx
const router = createRouter({
  routeTree,
  context: { queryClient },
  rewrite: {
    // Browser URL -> internal URL: always canonicalize to NB route ids
    input: ({ url }) => {
      url.pathname = toCanonicalPath(url.pathname)
      return url
    },
    // Internal URL -> address bar: localize for the active language
    output: ({ url }) => {
      url.pathname = toPublicPath(
        url.pathname,
        i18n.resolvedLanguage === "en" ? "en" : "nb",
      )
      return url
    },
  },
})
```

(`import "./i18n"` at `main.tsx:15` already runs before `createRouter`, and detection is synchronous `localStorage`, so `i18n.resolvedLanguage` is safe here.)

```ts
// client/src/hooks/useLocalizedNavigate.ts — no more equivalents map, no `as any`
export function useSwitchLocale() {
  const navigate = useNavigate()
  return (targetLocale: "en" | "nb") => {
    void i18next.changeLanguage(targetLocale).then(() =>
      // Re-commit the current location so the output rewrite re-renders the URL
      navigate({ to: ".", replace: true }),
    )
  }
}
```

Note the ordering trap the table must handle: `/innstillinger` (user settings) vs `/administrer/innstillinger` (admin settings) — longest-prefix, segment-boundary matching resolves it; the unit tests must cover it.

## Migration order

1. **Create `client/src/i18n/localizedPaths.ts` + `localizedPaths.test.ts`** (pure functions, no router). Test: every pair round-trips both directions; `/administrer/innstillinger` vs `/innstillinger`; unmapped paths (`/onboarding`, `/`) pass through; nested suffixes preserved (`/administrer/fordelingspolicy/persondays` under the `/administrer` prefix if only the prefix is mapped).
2. **Wire `rewrite` into `createRouter`** in `client/src/main.tsx`. At this point both trees still exist — the rewrite canonicalizes EN URLs to NB before matching, so the EN route files become unreachable dead code but nothing breaks. Smoke-test in dev: visit `/dashboard?property=1&user=2` → Dashboard renders, search params retained; switch language on `/oppgjor` → URL shows `/settlement`. **Gate: if the rewrite misbehaves here, stop and fall back to Option B** (redirect stubs, matching the existing admin-subtree convention).
3. **Rewrite `useSwitchLocale`** (`client/src/hooks/useLocalizedNavigate.ts`) as sketched; verify the `navigate({ to: ".", replace: true })` re-commit updates the address bar (if the router skips committing an unchanged internal location, use `router.navigate({ href: location.pathname, replace: true })` instead — verify during step 2's smoke test).
4. **Fix the two stray EN references** (type-check will force the second one once files are deleted): `routes/_onboarding/onboarding.tsx:25` `"/dashboard"` → `"/oversikt"`; `features/home/UnauthenticatedView.tsx:35` `callbackURL: "/dashboard"` → `"/oversikt"` (it works either way via input rewrite, but normalize for consistency) and update the assertion in `UnauthenticatedView.test.tsx:71`.
5. **Delete the EN route files** — 9 top-level: `routes/_authed/{dashboard,planstay,expenses,maintenance,settlement,shoppinglist,todos,usersettings,manageproperty}.tsx`; plus the whole `routes/_authed/manageproperty/` stub folder (13 files). Do **not** touch `routeTree.gen.ts` — the vite plugin regenerates it on next `dev`/`build`. Delete `routeEquivalents.ts`. NB files (`oppgaver.tsx` etc.) and the `-priority/` folder are untouched.
6. **Extend the table with the remaining admin children** (`kontakter/contacts`, `eierskap/ownership`, `bygninger/structures`, `infrastruktur/infrastructure`, `utstyr/equipment`, `brukere/users`, `brukergrupper/usergroups`, `innstillinger/settings`, `prioritet/priority`, `fordelingspolicy/split-policy`, plus English names for the currently NB-only `sesonger`, `utgiftskategorier`, `persondays`). Optional, separate commit — this _restores_ localized admin URLs that the redirect stubs had abandoned, at one data line per page.

## Verification

- `pnpm type-check` (`tsc -b --noEmit`) — proves no `Link`/`navigate` still targets a deleted EN route id (the route-id string literals are the type surface).
- `pnpm lint`, `pnpm test` (vitest with `typecheck.enabled`, includes the new `localizedPaths` unit tests), `pnpm format:check`.
- Manual, both languages: in NB navigate `oversikt → planleggopphold → oppgjor → administrer/invitasjoner` and confirm NB URLs + retained `property`/`user` params; deep-link `/dashboard`, `/todos`, `/manageproperty/invites` and confirm the right pages render; toggle `LanguageSwitcher` on `/oppgjor` (URL → `/settlement`, page state preserved) and back; browser back/forward across a locale switch; nav-tab active states in both locales (they match internal NB paths regardless of displayed URL); `pnpm preview` production/PWA sanity (workbox `navigateFallback` serves `index.html` for any path, so rewrites are unaffected).

## Critical files

- `client/src/main.tsx` (add `rewrite` to `createRouter`)
- `client/src/i18n/routeEquivalents.ts` (replaced by new `client/src/i18n/localizedPaths.ts` table + translate functions)
- `client/src/hooks/useLocalizedNavigate.ts` (`useSwitchLocale` re-commit instead of map lookup)
- `client/src/routes/_authed/manageproperty.tsx` (representative of the 22 EN files to delete; sibling stubs under `routes/_authed/manageproperty/`)
- `client/src/routes/_onboarding/onboarding.tsx` (stray `"/dashboard"` redirect, plus `features/home/UnauthenticatedView.tsx`)
