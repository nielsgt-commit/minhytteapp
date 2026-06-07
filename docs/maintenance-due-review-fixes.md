# Plan: fixes for the maintenance `due` union review (findings 1–10)

> **✅ ALL 10 COMPLETE (2026-06-06).** Each finding's section below carries a DONE
> note with what changed and how it was verified. Net verification across the batch:
> `npm run type-check`, eslint + prettier on all touched files, and the maintenance +
> dashboard vitest suites (72 passing). No DB migration was needed (the #4 schema edit
> is a pure refactor — `db:generate` reports no changes). Two deliberate deviations from
> the original plan, both explained inline: #5 skipped the suggested `normalizeDue` unit
> test (no server test harness), and #9 mirrors the reader's `isoWeekYear` instead of
> `defaultYear()` (which wouldn't actually align the cache). The review also undercounted
> #1's blast radius — two extra `MaintenanceHistory` callers had the same wipe bug; both
> fixed.
>
> _Original pick-up note: the feature was just built; this plan addressed bugs/cleanups
> found in review. #1 and #2 were correctness regressions; the rest medium/low._

## Post-review follow-ups (found during a code review of the above, 2026-06-06)

- **PR-1 — `due_priority_group_id` not validated against the property (pre-existing
  feature gap).** `maintenance.create`/`update` authorized the property but never checked
  the referenced group, so a non-existent id → FK 500 (not 400) and a cross-property group
  could be stored. **Fixed:** exported `ensureMainGroupOfProperty` from `priority.ts`
  (the same `is_family` + `property_id` check `priority.set/clear` and `eligibleOwners`
  use) and call it in create/update when `due_kind === 'priority_week'`. No cycle
  (`priority.ts` doesn't import `maintenance.ts`).
- **PR-2 — controlled date field couldn't be cleared (regression from #10).** Clearing
  reverted to the old date. **Fixed:** `MaintenanceDueSelect` now drives the date input
  from a local `dateDraft` state, resynced from `value.due_at` via `useEffect` — clearable
  *and* still reflects external changes. Verified: type-check, lint/prettier, vitest (72).

## Context / orientation

The change made a maintenance item's "due" a categorical union instead of a bare
timestamp. A `due` is one of:

- `not_decided` (default) · `dugnad` · `opening` · `closing` — static buckets, no date
- `priority_week` — references a family **user group** via `due_priority_group_id`;
  resolved dynamically to the ISO week that group owns for a given year
- `date` — an arbitrary `due_at` timestamp

### Key files

| Layer | Path |
|---|---|
| Schema (cols + CHECK) | `server/src/db/schema/maintenance.schema.ts` (cols ~L90–107, CHECK `maintenance_due_shape` ~L124) |
| Relations | `server/src/db/schema/relations.ts` (`duePriorityGroup`) |
| Migration | `drizzle/0074_red_brood.sql` (already applied locally; has a backfill UPDATE) |
| tRPC | `server/src/trpc/routers/maintenance.ts` (`dueKindValues` L19, `dueShape` L54, `normalizeDue` L70, create L152, update L186) |
| Due helpers | `client/src/features/maintenance/due/maintenanceDue.ts` |
| Due select UI | `client/src/features/maintenance/due/MaintenanceDueSelect.tsx` |
| Todo card (writer) | `client/src/features/maintenance/maintenancecard/MaintenanceTodos.tsx` (`baseUpdate` ~L120) |
| Planned summary (reader) | `client/src/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx` |
| Priority shared utils | `client/src/routes/_authed/administrer/-priority/priorityUtils.ts` (`buildOwnerLookups`, `defaultYear`) |
| Priority tRPC | `server/src/trpc/routers/priority.ts` (`list` uses `propertyAdminProcedure` = member-level) |

### How due validation flows (read before touching #5)

Three layers enforce the shape; understand all three before editing:
1. **DB CHECK** `maintenance_due_shape` — hard invariant.
2. **zod `dueShape` refine** on create/update inputs — strict reject.
3. **`normalizeDue()`** — permissive normalizer that nulls irrelevant columns before insert/update.

### Verification commands

```bash
npm run type-check          # tsc -b --noEmit
npx eslint <changed files>
npx prettier --check <changed files>
npx vitest --run --config client/vite.config.ts client/src/features/maintenance
# DB changes: npm run db:generate && npm run db:migrate (review SQL in drizzle/ first)
```

---

## 🔴 #1 — InspectionCard.cycleFindingSeverity wipes a finding's due (DATA LOSS) ✅ DONE

> **Done 2026-06-06.** Forwarded `due_kind`/`due_priority_group_id`/`due_at` (and the
> previously-omitted `equipment_id`) in `InspectionCard.cycleFindingSeverity`. The grep
> turned up **two more** hand-built callers the original review missed:
> `MaintenanceHistory.cycleItemSeverity` and `MaintenanceHistory.handleEditSubmit` — both
> omitted the due fields and were wiping dues on completed items. Both fixed the same way.
> Verified: type-check, eslint, prettier, maintenance vitest suite (44 passing).



**File:** `client/src/features/maintenance/inspectionflow/InspectionCard.tsx:72` (`cycleFindingSeverity`)

**Problem:** This caller of `trpc.maintenance.update` omits `due_kind` / `due_priority_group_id` / `due_at`. Server zod `due_kind` has `.default("not_decided")`, then `normalizeDue()` forces `due_at = null` and `due_priority_group_id = null`. So cycling a finding's severity silently clears any due that was set on it. (`MaintenanceTodos` was routed through `baseUpdate` to preserve these; this sibling was missed.)

**Fix:** forward the existing due fields from `f`, mirroring `MaintenanceTodos.baseUpdate`:

```ts
const cycleFindingSeverity = (f: (typeof findings)[number]) => {
  updateMutation.mutate({
    id: f.id,
    description: f.description,
    instructions_pt: f.instructions_pt,
    assigned_to_id: f.assigned_to_id ?? undefined,
    structure_id: f.structure_id ?? undefined,
    infrastructure_id: f.infrastructure_id ?? undefined,
    // NOTE: original also omits equipment_id — verify findings can't be equipment-scoped;
    // if they can, add equipment_id: f.equipment_id ?? undefined here too.
    category: f.category,
    severity: cycleSeverity(f.severity),
    status: f.status,
    recurrence: f.recurrence,
    due_kind: f.due_kind,
    due_priority_group_id: f.due_priority_group_id ?? undefined,
    due_at: f.due_at ? new Date(f.due_at) : undefined,
  })
}
```

**Also:** grep for any other `trpc.maintenance.update`/`create` callers that build the
payload by hand and omit due fields (`grep -rn "maintenance.update\|maintenance.create" client/src`).
As of review only `MaintenanceTodos` (ok) and `InspectionCard` (this bug) call update on the client.

**Better long-term fix (consider):** make the update procedure *patch* semantics so omitted
fields are left untouched instead of defaulted+normalized. That removes the whole class of
"forgot to forward a field → silent wipe". See #5 — it's the same root cause.

**Verify:** set a priority-week/date due on an inspection finding, cycle its severity, confirm the due persists.

---

## 🔴 #2 — FK `onDelete: "set null"` contradicts the CHECK → group/property delete aborts ✅ DONE

> **Done 2026-06-06.** Took **Option A**: normalize referencing priority-week rows to
> `not_decided` (+null group) in the same transaction *before* deleting the group(s), in
> both `userGroup.delete` (now wrapped in a tx) and the `property.ts` deletion cascade.
> FK SET NULL kept as a backstop. No schema/migration change. Verified: type-check, eslint,
> prettier pass.



**File:** `server/src/db/schema/maintenance.schema.ts:103–106` (`due_priority_group_id` FK)

**Problem:** CHECK `maintenance_due_shape` requires `due_priority_group_id IS NOT NULL` when
`due_kind = 'priority_week'`. The FK nulls only the column on delete, leaving
`due_kind = 'priority_week'` → row violates the CHECK → the whole delete transaction aborts.
Triggered by:
- `server/src/trpc/routers/userGroup.ts:219` — `userGroup.delete`
- `server/src/trpc/routers/property.ts:316` — property deletion cascade (`delete(userGroupsTable)`)

A plain FK can't atomically flip two columns, so SET NULL alone can never satisfy the CHECK.

**Fix — pick one:**

- **Option A (recommended): normalize in the delete procedures.** Before deleting a group, in the
  same transaction reset any referencing priority-week rows back to `not_decided`:
  ```ts
  await tx.update(maintenanceTable)
    .set({ due_kind: "not_decided", due_priority_group_id: null })
    .where(eq(maintenanceTable.due_priority_group_id, groupId))   // or inArray(..., groupIds) in property.ts
  // then delete the group(s)
  ```
  Do this in **both** `userGroup.delete` and `property.ts` cascade. Keep the FK as a backstop.

- **Option B: DB trigger** — `BEFORE DELETE` on `user_groups` that resets matching maintenance rows.
  Authoritative regardless of code path, but adds a raw-SQL migration (drizzle won't generate it).

- **Option C: relax the CHECK** to allow `priority_week` with a null group (treat null group as
  "unresolved"). Simpler DB-wise but weakens the invariant and the reader code must handle null
  groups under `priority_week` everywhere (`PlannedMaintenanceSummary`, `MaintenanceDueSelect`).
  Not recommended.

**Verify:** create a maintenance item with `due_kind='priority_week'` pointing at group G, then
delete G via the group-management UI / `userGroup.delete`; the delete should succeed and the item
should fall back to "not decided". Repeat for full property deletion. Add an integration test if
the project has DB-backed tests.

---

## 🟠 #3 — `priority.list` is non-suspense beside suspense queries → priority-week items mis-bucketed during load ✅ DONE

> **Done 2026-06-06.** Switched `priority.list` to `useSuspenseQuery` in
> `PlannedMaintenanceSummary`, dropped the now-redundant `enabled` gate, and removed the
> `?? []` fallbacks (data is now guaranteed). Confirmed safe: the sibling suspense queries
> (`structure`/`maintenance` `listForProperty`) both require `property_id` positive and run
> unconditionally, so the component only ever mounts with a real property; `priority.list`
> is member-level (`propertyAdminProcedure`) and was already called here. Verified type-check
> + dashboard/maintenance vitest (72 passing).



**File:** `client/src/features/dashboard/calendarsummary/plannedmaintenance/PlannedMaintenanceSummary.tsx:52`

**Problem:** `items`/`structures` use `useSuspenseQuery` (resolved before render), but `priority`
is a plain `useQuery`. While it loads, `weekByGroup` is empty, so every `priority_week` item fails
`inDisplayedWeek` → dropped from "this-week" and shown in "rest" without its week label, then jumps
when it resolves. If the query errors, priority-week items never show in "this-week" that session.

**Fix — pick one:**
- **Switch to `useSuspenseQuery`** for `priority.list` (matches the siblings; render waits for it).
  Cleanest. Confirm a Suspense boundary wraps this component (the others already suspend, so yes).
  Keep the `propertyId !== 0` concern in mind — the suspense `structure`/`maintenance` queries
  already run unconditionally with `property_id: propertyId`, so the parent only mounts this with a
  real property; `priority.list` can do the same. (Note: `priority.list` input is `.int().positive()`,
  so it must not run with `property_id: 0`.)
- **Or** keep `useQuery` but gate bucketing on readiness: while `priority.isLoading`, render a
  skeleton/"…" instead of computing buckets, so items don't flash into the wrong bucket.

**Verify:** throttle network, load the dashboard, confirm a current-week priority-week item appears
directly in "this week" with its label and doesn't flash into "rest".

---

## 🟠 #4 — `due_kind` enum declared in 3+ unsynced places ✅ DONE

> **Done 2026-06-06.** `dueKindValues` + `DueKind` now exported from
> `maintenance.schema.ts` (server source of truth); the column uses `enum: dueKindValues`
> and `maintenance.ts` imports both (local copies deleted). Added KEEP-IN-SYNC comments at
> the const, the DB CHECK `IN (...)`, and the client `DueKind`. `db:generate` reports "no
> schema changes" — pure refactor, no migration. Verified type-check + lint.



**Files:** `server/src/trpc/routers/maintenance.ts:19` (`dueKindValues`),
`server/src/db/schema/maintenance.schema.ts` (column enum + CHECK `IN (...)`),
`client/src/features/maintenance/due/maintenanceDue.ts` (`DueKind`).

**Problem:** adding/removing a kind means editing the literal in ~4 spots; miss the DB CHECK's
`IN (...)` and inserts fail in prod with an opaque constraint error.

**Fix:** define the kind list once and reuse:
- Export `dueKindValues` (and `DueKind`) from the schema file (server source of truth) and import
  it into `maintenance.ts` for the zod enum.
- The DB CHECK `IN ('not_decided', ...)` still must be hand-kept in sync (it's SQL) — leave a
  comment at both the CHECK and the const list pointing at each other.
- Client `maintenanceDue.ts` `DueKind` can't import server code; keep it but add a comment linking
  to the server const, or add a tiny shared types package if one exists (check `shared/` conventions).

Low risk, no behavior change. Type-check after.

---

## 🟠 #5 — `normalizeDue` and the zod `dueShape` refine disagree ✅ DONE

> **Done 2026-06-06.** Relaxed `dueShape.check` to only assert what `normalizeDue` can't
> invent: `date` ⇒ `due_at != null`, `priority_week` ⇒ `due_priority_group_id != null`,
> else `true`. Dropped the "other field must be null" clauses (normalizeDue nulls them; DB
> CHECK is the hard backstop), so forwarding a stale `due_at` on a non-date kind is now
> sanitized instead of 400-ing — this removes the root cause behind #1's whole class.
> **Skipped the suggested `normalizeDue` unit test:** `normalizeDue` is unexported and the
> server has no test harness (the runner is `client/vite.config.ts`); not worth standing one
> up for this. Verified type-check + lint.



**File:** `server/src/trpc/routers/maintenance.ts` (`dueShape` L54, `normalizeDue` L70)

**Problem:** the refine **rejects** inputs like `due_kind:'not_decided'` + a stray `due_at`, but
`normalizeDue` would have safely nulled it. A harmless redundant field becomes a hard 400. This is
also the root cause behind #1's whole class of bugs (strict-reject vs forgiving-normalize).

**Fix:** make the two layers coherent. Recommended: keep `normalizeDue` as the sanitizer and
**relax the refine** to only assert what normalize can't invent:
- `date` ⇒ `due_at != null`
- `priority_week` ⇒ `due_priority_group_id != null`
- (drop the "and the other field must be null" clauses — `normalizeDue` nulls them anyway)

This way forwarding a stale `due_at` on a non-date kind is silently normalized instead of 400-ing,
and the DB CHECK remains the hard backstop. Re-run the maintenance tests; add a unit test asserting
`normalizeDue({due_kind:'not_decided', due_at: <date>})` → `{due_at: null, ...}` and that the input
is accepted.

> If you instead adopt patch-semantics for update (see #1 "better fix"), revisit this together.

---

## 🟠 #6 — `toDateInputValue` duplicated with inconsistent (UTC) timezone semantics ✅ DONE

> **Done 2026-06-06.** Extracted one local-time `toDateInputValue(string|Date|null)` into
> `client/src/utils/dateUtils.ts` (delegates to `toIso`); both `MaintenanceDueSelect` and
> `MaintenanceHistoryEditForm` import it, local copies removed. **Chose local-day semantics
> deliberately** and made it consistent end-to-end: `MaintenanceDueSelect.handleDate` now
> parses at local noon (`${str}T12:00:00`) instead of `new Date(str)` (UTC midnight),
> matching `MaintenanceHistoryEditForm` and how `inDisplayedWeek` compares against the local
> `wkStart`. This also fixes a latent off-by-one-day for west-of-UTC users. Verified
> type-check + lint + maintenance vitest.



**File:** `client/src/features/maintenance/due/MaintenanceDueSelect.tsx:17`

**Problem:** two other formatters already exist — `dateUtils.toIso` and a **local-time**
`toDateInputValue` in `client/src/features/maintenance/maintenancecard/MaintenanceHistoryEditForm.tsx:28`
(uses `getFullYear/getMonth/getDate`). The new copy uses `toISOString()` (UTC). Three formatters,
two semantics; self-created dates round-trip but it can show the wrong day for users far from UTC
and is inconsistent with the sibling form.

**Fix:** extract one shared helper (prefer the **local-time** variant to match `MaintenanceHistoryEditForm`
and human intent for a calendar date) into `client/src/utils/dateUtils.ts` (e.g. `toDateInputValue`),
and have both `MaintenanceDueSelect` and `MaintenanceHistoryEditForm` import it. Remove the two local
copies. Decide deliberately whether due dates are local-day or UTC-day and apply consistently with how
`PlannedMaintenanceSummary.inDisplayedWeek` compares `new Date(due_at)` against the local `wkStart`.

**Verify:** pick a date in the due selector, save, reopen — same day shown; confirm it buckets into
the expected week in the dashboard.

---

## 🟡 #7 — Reimplements `buildOwnerLookups` ✅ DONE

> **Done 2026-06-06.** Added `weekByGroup: Map<number, number>` to `OwnerLookups` /
> `buildOwnerLookups` (inverse of `ownersByWeek`, built over all assignments).
> `PlannedMaintenanceSummary` now destructures `{ ownerNameById, weekByGroup }` from
> `buildOwnerLookups(priority.eligibleOwners, priority.assignments)` instead of hand-rolling
> the two maps. Existing `buildOwnerLookups` consumers (priority routes) unaffected (added
> field). Verified type-check + lint + dashboard vitest.



**File:** `PlannedMaintenanceSummary.tsx:58–65` (hand-rolled `ownerNameById` + `weekByGroup`)

**Fix:** reuse `buildOwnerLookups(eligibleOwners, assignments)` from
`client/src/routes/_authed/administrer/-priority/priorityUtils.ts:53`. It already builds
`ownerNameById` and `ownersByWeek`. Note this component needs **week-by-group** (not owners-by-week);
either add a `weekByGroup` to `OwnerLookups` in the shared util (preferred, so all consumers share it)
or derive it from `assignments` with a clear comment. Avoid leaving two divergent indexings of
`priority.assignments`.

---

## 🟡 #8 — Three parallel maps in `renderRest` ✅ DONE

> **Done 2026-06-06.** Collapsed `bucketItems`/`labelFor`/`sortKey` into one
> `Map<string, { items: Item[]; label: string; order: number }>`. Removed the defensive
> `?? 0` / `?? []` fallbacks; sort now reads `bucket.order` directly. Verified type-check +
> lint + dashboard vitest.



**File:** `PlannedMaintenanceSummary.tsx:160` (`bucketItems` / `labelFor` / `sortKey` + `add()`)

**Fix:** collapse to one structure, e.g. `Map<string, { items: Item[]; label: string; order: number }>`,
or an array of bucket objects. Removes the defensive `?? 0` fallbacks and the risk of the three maps
disagreeing on which keys exist; future per-bucket fields (color/icon) won't need a fourth map.

---

## 🟡 #9 — Year-semantics mismatch between writer and reader ✅ DONE

> **Done 2026-06-06.** `MaintenanceTodos` now sets `priority.list` `year` to
> `isoWeekYear(addDays(startOfSunday(new Date()), 3))` — the *exact* current-week refYear
> `PlannedMaintenanceSummary` computes — so the cache key aligns and they agree at the
> late-Dec ISO-week/year boundary. **Deviated from the plan's `defaultYear()` suggestion on
> purpose:** `defaultYear()` flips to next year in autumn and would NOT match the reader,
> which must use `isoWeekYear(refMid)` (it varies with week navigation). Mirroring the reader
> is what actually shares the cache. Verified type-check + lint.



**Files:** `MaintenanceTodos.tsx:43` (`year: new Date().getFullYear()`) vs
`PlannedMaintenanceSummary.tsx` (`isoWeekYear(refMid)`).

**Problem:** harmless for the owners dropdown (family groups are year-independent) but the
`priority.list` query keys never align, so the cache isn't shared and the two can disagree at the
ISO-week/year boundary (late Dec).

**Fix:** use one year helper everywhere. `priorityUtils.defaultYear()` exists and encodes the
"upcoming summer" intent; prefer it (or `isoWeekYear`) consistently in both call sites so the cache
key matches. Low impact; mostly a dedupe + correctness-at-boundary tidy.

---

## 🟡 #10 — Uncontrolled date `Textfield` (`defaultValue`) ✅ DONE

> **Done 2026-06-06.** Switched the date `Textfield` from `defaultValue` to controlled
> `value={toDateInputValue(value.due_at)}`, so an externally-changed `due_at` (after a
> save/refetch) is reflected without a remount. `handleDate` still ignores empty strings, so
> the field can't be left in an invalid empty-date state while kind is 'date'. Verified
> type-check + lint + maintenance vitest.



**File:** `client/src/features/maintenance/due/MaintenanceDueSelect.tsx:83`

**Problem:** `defaultValue` is read once at mount; a `value.due_at` that changes externally (e.g.
after save) won't update the field without a remount. Minor UX.

**Fix:** make it controlled — drive the input from a `value`/state synced to `value.due_at`, or key
the field on the item id so it remounts when the underlying item changes. Keep the "don't fire
onChange until a real date is entered" behavior (`handleDate` ignores empty strings).

---

## Suggested order & batching

1. **#1, #2** — correctness, do first; each is a small, independent change. Add tests.
2. **#5** (refine/normalize coherence) — pairs naturally with #1's "better fix" discussion.
3. **#3** — small, user-visible; do alongside the dashboard reader work.
4. **#4, #6, #7, #9** — dedupe/shared-source cleanups; can batch.
5. **#8, #10** — local polish; lowest priority.

After each layer: `npm run type-check`, lint, prettier, and the maintenance vitest suite.
For #2 (and any schema/migration change) run `npm run db:generate` and review the SQL before `db:migrate`.
Do **not** run `i18n:extract` (it deletes dynamic keys) — add locale keys by hand if any new strings appear.
