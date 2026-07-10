# Review — plans 01–06 against React 19 / TanStack / tRPC current docs

> Review agent output, 2026-07-10. Grounded via context7 (React `/react/react` v19.2.7,
> TanStack Router `/websites/tanstack_router_v1`, TanStack Query `/websites/tanstack_query_v5`,
> tRPC `/trpc/trpc` — all lookups succeeded) plus spot-checks of the installed packages and repo files.
> Suggestions only — no plan files were modified. See `recommendations.md` for the keep/dismiss verdicts.

## Verification summary (grounding)

- **Plan 02's `rewrite` API is real and the plan's shape is correct.** Confirmed against TanStack Router v1 docs (`guide/url-rewrites.md`, `api/router/RouterOptionsType.md`, `guide/internationalization-i18n.md`) and against the installed package: `@tanstack/react-router@1.168.23`, and `rewrite`/`composeRewrites` are present in `node_modules/@tanstack/react-router/dist/esm/index.js`. The doc's exact signature: `createRouter({ rewrite: { input: ({url}) => ..., output: ({url}) => ... } })`, both receive a `URL`, may mutate-and-return, return a new URL/string href, or `undefined` to skip. This matches the plan verbatim.
- **React 19 `useOptimistic`** (docs: `react/fixtures/flight-parcel/src/TodoItem.tsx`) is exclusively shown with `startTransition` + Server Actions holding optimistic state _locally in the component_. It is **not** a cache-based mechanism.
- **TanStack Query v5** optimistic docs (`framework/react/examples/optimistic-updates-cache`) confirm the `onMutate`/`cancelQueries`/`getQueryData`/`setQueryData` + `onError` rollback + `onSettled` invalidate pattern as canonical for cache-based optimism.
- **tRPC** docs (`packages/client/skills/links/SKILL.md`, `packages/tanstack-react-query/skills/react-query-setup`) confirm custom terminating links via `observable` and `createTRPCClient<AppRouter>({ links: [...] })` + `createTRPCOptionsProxy`/`createTRPCContext` — exactly plan 05's harness design.

---

## Plan 01 — Extract router services

**Verdict: sound**

No client-contract risk. The plan's central safety property — that services return the **raw** DB row and the router keeps `toWire*` — is exactly what preserves `AppRouter` inference, so the wire types the client consumes cannot drift. The `computePreviewSplit` in-place mutation and non-transactional `advancePhase` are correctly flagged as "move verbatim, fix later."

1. **Confirm the service files stay out of the client import graph so they never widen the isomorphic surface** — _recommended_. The plan already forbids `services → trpc/` imports (good). Add an explicit note that services must not be imported by anything under `server/src/shared/` either, so the new `services/booking.ts`/`settlementPhase.ts` can freely use `dbClient`/`TRPCError` without risk of one accidentally being pulled into the browser bundle via the shared kernel. This dovetails with plan 03's kernel lint rule. Premise: the architecture review notes the client reaches into exactly 6 server modules; keeping services off that list is a contract guarantee, not just hygiene.

---

## Plan 02 — Bilingual route dedup via `rewrite`

**Verdict: sound-with-suggestions** (the core bet is verified correct; three caveats need to be surfaced in the plan's risk section)

The riskiest premise checks out: the API shape, the version, and the "rewrite only edits `url.pathname`, search params pass through" claim are all correct, and the docs explicitly endorse this as the i18n use case. Also confirmed: `<Link>` applies **output** rewrites when generating `href` (docs: "Link Component with Rewrites"), and active-state matching runs on the internal path — so the plan's claim "nav-tab active states match internal NB paths regardless of displayed URL" is correct.

1. **Add a caveat: `<Link>` hrefs only re-localize when the component re-renders** — _recommended (blocking to validate in the step-2 smoke test)_. Output rewrites are applied at href-generation time reading `i18n.resolvedLanguage`. After `changeLanguage`, react-i18next only re-renders components subscribed via `useTranslation`; a `<Link>` in a component that doesn't consume a translation will keep its stale (previous-locale) href until its next render. Most nav components here use `useTranslation` for labels so they'll re-render, but the plan should explicitly verify address-bar **and** in-page link hrefs after a locale switch, not just the current URL. The plan's `navigate({ to: ".", replace: true })` fixes the address bar only. Source: docs "Link Component with Rewrites" (hrefs computed from output at render).

2. **The `navigate({ to: "." })` re-commit behavior is an empirical unknown the docs do not settle** — _recommended_. Nothing in `url-rewrites.md` guarantees the router re-runs the **output** rewrite and rewrites history when the _internal_ location is unchanged (only the display locale changed). The plan already gates on a smoke test and offers `router.navigate({ href: location.pathname, replace: true })` as fallback — keep that fallback prominent; this is the one place the plan relies on unverified behavior.

3. **Finding 6 (the code-splitter internals claim that rejects Option A) could not be independently verified via docs** — _nit_. It's a claim about `router-plugin`'s AST compiler skipping non-`ObjectProperty` nodes. The public docs (`automatic-code-splitting.md`) only document _what_ gets split (component/errorComponent/notFoundComponent chunks) and `codeSplitGroupings`/`splitBehavior`, not the spread-object edge case. This is moot for the chosen Option C, so no action needed — just don't present it as doc-confirmed.

4. **The plan strengthens its own case: the _current_ `routeEquivalents.ts` is already drifted** — _nit, worth citing as motivation_. `client/src/i18n/routeEquivalents.ts` maps only 8 paths and is **missing `todos/oppgaver` and `shoppinglist/handleliste` entirely**. So today `useSwitchLocale` on `/todos` returns the same path (silent no-op) — a live bug. Plan 02's `LOCALIZED_PATHS` table includes both, which fixes it. Add this to the plan's justification; it's concrete evidence of the "silent drift" the review only asserted abstractly.

---

## Plan 03 — Feature boundaries + kernel lint

**Verdict: sound-with-suggestions**

The `no-restricted-imports` approach is valid (core rule supports `patterns`/`group`/`regex`; `@typescript-eslint/no-restricted-imports` supports `allowTypeImports`). The barrel direction and cycle-break (settlement→expenses only, deleting the `phase.ts` shim in favor of direct `@server/shared/splitPolicy.ts`) are architecturally correct.

1. **The barrel/tree-shaking concern is mostly a non-issue _here_, but state the two real conditions in the plan** — _recommended_. Modern Rollup (Vite prod build) tree-shakes **per named export** across side-effect-free re-export barrels, and TS erases `import type`, so `import { selectMyExpenses }` or `import type { ExpenseRow }` from `@/features/expenses` will **not** pull the heavy `ReviewExpenses.tsx` (a different module, imported with its CSS side effect) into the consumer's chunk. Route-level `autoCodeSplitting` (confirmed: splits at `component`) is unaffected because barrels sit _inside_ already-split route component chunks. Two conditions the plan should assert to keep this true: (a) barrels must contain **only** re-exports, no side-effectful top-level code; (b) barrels must stay **cycle-free** — since this very plan exists to break the settlement⇄expenses cycle, note that a barrel re-exporting a module that imports back through another barrel would silently reintroduce it. Recommend the verification step also run a cycle check (e.g. `madge --circular` or equivalent) after step 9, not just the grep in section 5.

2. **`allowTypeImports` on the client→server rule (block c) is correct, but verify `verbatimModuleSyntax`/`isolatedModules` interplay** — _nit_. The rule relies on TS distinguishing `import type` from value imports; the repo is strict TS. Just confirm `client/src/trpc/client.ts`'s `AppRouter` import is written as `import type` (the plan assumes it is) — otherwise the bonus rule will flag it. Cheap to check during implementation.

3. **No React 19 idiom concerns** — the moves are pure file relocations; nothing here touches hooks/memoization, so React Compiler-era guidance is not implicated.

---

## Plan 04 — Pattern consolidation

**Verdict: sound-with-suggestions** (one wording correction on the mutation-convention rationale; the core decisions are right)

1. **Item (d): the justification "raw `useMutation` only for optimistic updates" is imprecise — the wrapper already supports optimistic updates** — _recommended_. All six of `Todos.tsx`'s optimistic mutations go **through** `useMutationWithInvalidation`, passing `onMutate`/`onError` in the options (lines 168–298), and `useMutationWithInvalidation.ts` only wraps `onSuccess`, leaving `onMutate`/`onError` untouched. So optimistic caching is _not_ a reason to drop to raw `useMutation`. The genuine reasons for the 5 raw sites (per the plan's own enumeration) are `onSettled`-based invalidation, success-ordering, and shared cross-mutation invalidation — not "optimistic updates." Fix the doc/lint message wording accordingly, or it will mislead contributors (and mis-describe Todos). Severity recommended because the lint message becomes the living convention.

2. **Item (d)/wrapper: consider invalidating on `onSettled`, not `onSuccess`** — _recommended_. TanStack Query v5 optimistic docs (`optimistic-updates-cache`) invalidate in `onSettled` (after success **or** error) precisely so the cache re-reconciles after a rollback. `useMutationWithInvalidation` invalidates only in `onSuccess`, so an optimistic mutation that errors rolls back to `ctx.previous` but never refetches to confirm the server truth. This is arguably out of scope for (d)'s "no sweep" stance, but it's the one substantive divergence from current guidance and worth noting as a follow-up rather than silently codifying `onSuccess`-only as the blessed pattern.

3. **Item (a) `wireMap` factory does not weaken the client contract — confirm via `type-check` as stated** — _nit / affirmation_. The `DateKeys` compile-guard is a genuine improvement over hand-lists and the plan correctly relies on `pnpm type-check` as the end-to-end equivalence proof (client consumes inferred `AppRouter`). No doc conflict. The documented limitation that `plainDate` strings can't be guarded is honestly stated and acceptable.

4. **`useOptimistic` is correctly _not_ proposed anywhere in this plan** — _affirmation_. Per React 19 docs, `useOptimistic` holds optimistic state locally within a `startTransition`/action and does not write to an external cache. The repo's optimism must live in the shared TanStack Query cache (multiple components read the same `todo.listForProperty` key), so the manual `onMutate` pattern is the idiomatic choice and `useOptimistic` would be a regression. No change needed — but if the plan ever tempts a `useOptimistic` rewrite, this is the reason not to.

---

## Plan 05 — Test coverage

**Verdict: sound-with-suggestions**

The `fakeTrpcClient` design is validated by tRPC docs: a custom **terminating** link returning an `observable` that resolves/rejects per `op.path`, wired via `createTRPCClient<AppRouter>({ links: [fakeLink] })`, and the options proxy built by `TRPCProvider` will run the component's real `queryOptions`/`mutationOptions`/`onMutate`/`onError` against a real `QueryClient`. This is the correct and current approach.

1. **State explicitly that the fake link must NOT apply a transformer, and that seeded/canned data is already in output shape** — _recommended_. In tRPC v11 the transformer lives on the terminating link (e.g. `httpBatchLink({ transformer })`); a custom terminating link that returns data directly performs no serialize/deserialize. The plan's "no transformer needed" is therefore correct — but the implication is that handlers and `seed(queryClient)` must supply **already-deserialized** values (real `Temporal.PlainDate`/`Instant` objects, not wire JSON), matching what `Todos.tsx` seeds (`Temporal.Now.instant()` at line 187). Make this explicit so the harness author doesn't accidentally hand it superjson-encoded payloads.

2. **React 19 form-action testing: prefer `userEvent`/`requestSubmit` and `await findBy…`; avoid bare `fireEvent.submit` for assertions on async action results** — _recommended_. React 19 form `action={fn}` runs inside a transition (async), confirmed by the docs' `useFormStatus`/`ReactDOMForm-test.js` patterns where the action is awaited. `Todos.tsx` uses `<form action={handleAdd}>` (line 417) and inline `action={fd => …}` (line 434). The plan's hedge ("`fireEvent.submit`/userEvent + `requestSubmit`") is on the right track, but tighten it: assert on optimistic results with `await screen.findBy…` (Testing Library flushes microtasks/act around `userEvent`), because the optimistic `setQueryData` happens in the transition and won't be synchronously visible after `fireEvent.submit`. This is the single most likely source of flaky/act-warning tests in Block B.

3. **Block B's "spy on `queryClient.invalidateQueries`" for the move-to-maintenance case** — _nit_. Because `useMutationWithInvalidation` invalidates in `onSuccess` via `Promise.all(...invalidateQueries)`, the test should `await` the mutation settling before asserting the spy fired (the invalidation is async and post-success). Recommend asserting via a refetch handler being called, or `await waitFor(() => expect(spy)…)`, rather than a synchronous check — otherwise the assertion races the `onSuccess` promise.

4. **Block A / Plan 01 Step 0 overlap is real — dedupe as the plan says** — _affirmation_. Both write settlement mutation-lifecycle characterization tests (`acceptSplit`, `advancePhase`/`regressPhase`, `markTransferPaid`). The plan already flags "write them once"; keep that coordination explicit so the two plans don't both create `server/src/trpc/routers/settlement.test.ts`.

---

## Plan 06 — Small latent items

**Verdict: sound**

1. **Registering the 4 schema modules changes `typeof db` (aliased `Db`) but not the wire contract — confirm no `AuthUser`/router inference shift** — _nit_. The plan already notes `Db` grows `db.query.<newTables>`. Since `Db` is threaded through services and `ctx.db`, the only client-visible risk would be if any procedure's _return type_ were inferred from `db.query.*` (relational API) — but the plan verified `db.query.*` is unused in production, so `AppRouter` inference is unaffected. Worth one line in the commit message asserting "no `AppRouter` diff," mirroring plan 04(a)'s type-check-as-proof discipline.

2. **Deleting the empty `en/category.json` is client-only and safe** — _affirmation_. Verified reasoning (unimported, not in `ns`, no `useTranslation("category")` consumers) is consistent with the review's own correction. No wire/contract impact.

3. **Optional win #2 (drop the `is_head` alias) does touch the client `me` wire type** — _recommended if taken_. The plan correctly scopes it as optional and notes client `me.is_head` is unread. If pursued, it's a genuine `AppRouter` output-shape change (removing a field from `user.me`), so it must go through `pnpm type-check` on the client, not just server tests — flag it as a contract change, not a pure server cleanup. The plan's "pairs with item (b) option 4" framing already implies this; just make the client-type touch explicit.

---

## Cross-cutting notes

- **No context7 lookup failed.** React (`/react/react` v19.2.7), TanStack Router (`/websites/tanstack_router_v1`), TanStack Query (`/websites/tanstack_query_v5`), and tRPC (`/trpc/trpc`) all resolved and returned relevant docs.
- **The single riskiest bet (plan 02's `rewrite`) is verified sound at the API level** against both current docs and the installed 1.168.23 dist. The residual risk is entirely in runtime re-render/re-commit behavior (suggestions 02-1 and 02-2), which the plan already routes through a smoke-test gate with an Option B fallback — appropriate.
- **No plan misapplies a React 19 idiom.** The one place `useOptimistic` could be mistaken for an upgrade (plan 04) correctly retains cache-based optimism, which is the right call for a shared TanStack Query cache.
