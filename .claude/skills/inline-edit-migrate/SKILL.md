---
name: inline-edit-migrate
description: Find and migrate "Edit mode" Switch/Checkbox toggles anywhere in the app to the inline-edit pattern using `useCanEdit` plus `InlineEditField` (blur-save) or `InlineEditRow` (Save/Cancel). Skill covers discovery + recipe; sub-agents migrate ONE panel per invocation.
---

# inline-edit-migrate

Two phases:

1. **Discover** — list all `editMode` toggles in the app, cross-check against the inventory below, pick a candidate.
2. **Migrate** — apply the recipe to exactly one panel and hand back.

Sub-agents working on a single panel skip discovery and jump to step 2 with the panel they were given.

## Scope (hard limits)

- **One panel per invocation.** Do not opportunistically migrate adjacent panels even if they look similar.
- **Do not edit the primitives.** `client/src/hooks/useCanEdit.ts`, `client/src/components/shared/InlineEditField.tsx`, and `client/src/components/shared/InlineEditRow.tsx` are stable and shared. If you think one needs changing, stop and hand back.
- **Do not touch the backend.** Permissions are already enforced via `headOrAdminProcedure` in `server/src/trpc/init.ts:27`. No new procedures, no input changes.
- **No new state libraries, no restyling, no refactors outside the migration.** Preserve existing FormData/`fdString`/`fdNumber` patterns, existing mutations, existing `useMutationsStatus`, existing CSS modules.
- **Do not "fix" pre-existing typecheck errors.** `t("Error: {{message}}", ...)` and `<Trans i18nKey="...">` produce strict-typing errors that exist verbatim in every panel. Preserve them as-is.

## Discovery — finding candidates

Run from repo root:

```bash
# Every place that renders an "Edit mode" toggle string (en or nb)
grep -rn 'label={t("Edit mode")' client/src --include="*.tsx"

# Every place that holds editMode local state (broader — catches variants)
grep -rn 'useState<.*>(false)\s*//.*editMode\|\[editMode' client/src/features --include="*.tsx"

# All Switch + Checkbox imports from Digdir in feature panels (manual triage)
grep -rln 'Switch\|Checkbox' client/src/features --include="*.tsx"
```

Cross-reference each hit against the **Inventory** table below before delegating. If a hit isn't in the table, treat it as **new — confirm with the user** whether it's edit-mode (migrate) or something else (skip).

## Inventory

| Panel                                                       | Path                                                                                           | Status      | Pattern                                        | Notes                                                                                                                                                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------- |
| PropertyContacts                                            | `client/src/features/property/propertyinfo/PropertyContacts.tsx` + `ContactListView.tsx`       | ✅ migrated | Save/Cancel                                    | Pilot. Uses `renderEditForm` render-prop.                                                                                                                                                                                                         |
| PropertyOwnersPanel                                         | `client/src/features/property/owners/PropertyOwnersPanel.tsx` + `OwnerListView.tsx`            | ✅ migrated | Blur-save                                      | `OwnerEditForm.tsx` deleted.                                                                                                                                                                                                                      |
| InfrastructurePanel                                         | `client/src/features/property/infrastructure/InfrastructurePanel.tsx`                          | ✅ migrated | Save/Cancel                                    | Form inlined as `renderEditForm` in same file.                                                                                                                                                                                                    |
| EquipmentPanel                                              | `client/src/features/property/equipment/EquipmentPanel.tsx`                                    | ✅ migrated | Save/Cancel                                    | Form inlined as `renderEditForm` in same file.                                                                                                                                                                                                    |
| ListPropertyStructures                                      | `client/src/features/property/testform/ListPropertyStructures.tsx`                             | ✅ migrated | Blur-save (name) + canEdit gating (expand/add) | Replaced double-click rename with single-click via `InlineEditField`.                                                                                                                                                                             |
| UserGroups                                                  | `client/src/features/usergroups/UserGroups.tsx` + `UserGroupsFlow.tsx` + `group/GroupCard.tsx` | ✅ migrated | Save/Cancel                                    | Rename + `is_main` checkbox inside `InlineEditRow` form slot in `GroupCard`. Delete moved to row `actions`. "+ New group" / "Add member" always visible to editors.                                                                               |
| Users                                                       | `client/src/features/usergroups/Users.tsx` + `users/ListUsers.tsx`                             | ✅ migrated | Save/Cancel                                    | Behavioural: list rewritten from `<table>` to `<ul>` of `<Card>` rows to match `GroupCard` precedent.                                                                                                                                             |
| Invites                                                     | `client/src/features/usergroups/Invites.tsx` + `invites/InvitesPanel.tsx`                      | ✅ migrated | Affordance-gating only                         | Invites are add-only + remove; no per-row `InlineEditRow`.                                                                                                                                                                                        |
| PropertyInfo                                                | `client/src/features/property/propertyinfo/PropertyInfo.tsx`                                   | 🛑 excluded | n/a                                            | Uses button-trigger + full-form replace (Matrikel address-lookup flow). Intentional.                                                                                                                                                              |
| AddNewExpenseFlow                                           | `client/src/features/expenses/testform/AddNewExpenseFlow.tsx` + `CategoryPicker.tsx`           | ✅ migrated | Coexisting affordances                         | Switch dropped; browse-chips + category-management `<Suggestion>` now coexist for heads (always visible). Uses inline `me?.is_head` (not `useCanEdit`) because the backend `expenseCategory` procedures require `is_head` strictly, not `is_admin |     | is_head`. Prop `editMode`→`canManage`. |
| SplitPolicyBuilder                                          | `client/src/features/settlement/splitpolicybuilder/SplitPolicyBuilder.tsx`                     | 🛑 excluded | n/a                                            | Switch toggles policy-load-for-edit, not edit-mode for a list.                                                                                                                                                                                    |
| ReviewSettlement / ReviewBookingDays / ReviewBookingDaysRow | `client/src/features/settlement/reviewsettlement/*.tsx`                                        | 🛑 excluded | n/a                                            | Switches gate review-progress and approval flows.                                                                                                                                                                                                 |
| FindingsSection                                             | `client/src/features/maintenance/inspectionflow/FindingsSection.tsx`                           | 🛑 excluded | n/a                                            | Switch belongs to the inspection finding flow.                                                                                                                                                                                                    |
| RuleEditor                                                  | (settlement/expenses rule editor)                                                              | 🛑 excluded | n/a                                            | Switch is rule-state, not edit-mode.                                                                                                                                                                                                              |

**When you add a new migration, update this table.** Status, path, pattern, and one-line note. Keep it current — this is how the next agent decides what to pick up.

## Pick the pattern (per panel)

Read the panel and its edit form. Then pick:

| Pattern                    | When                                                   | Primitive                                                                             |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Blur-save**              | Editing one field (a name, a number, a percentage)     | `<InlineEditField>`                                                                   |
| **Save/Cancel**            | Editing multiple fields together                       | `<InlineEditRow>` with a form (with its own Save/Cancel buttons) in the `form` slot   |
| **Affordance-gating only** | No per-row edit (e.g. add-only + remove, like Invites) | Neither primitive — just gate Add/Remove buttons on `canEdit`. Still drop the Switch. |
| **Both**                   | One inline-editable field + a multi-field expansion    | Use both primitives where they fit.                                                   |

## Required steps, in order

### 1. Read the target

Read the panel file end-to-end, plus any sibling `*ListView` / `*Flow` / `*Panel` / `*EditForm` / `*AddForm` files it imports. Identify:

- Where `useState(false)` for `editMode` lives
- Where `<Switch label={t("Edit mode")} ...>` or `<Checkbox label={t("Edit mode")} ...>` is rendered
- The cleanup branch inside `onChange` (`if (!next) { setEditingId(null); setIsAdding(false); ... }`)
- The render branch like `{editingItem ? <EditForm/> : isAdding ? <AddForm/> : <ListView/>}`
- The `editMode` prop on the list-view component and where it gates Edit/Delete buttons and "+ Add X"
- Whether the wrapper uses `useSuspenseQuery(trpc.user.me.queryOptions())` plus `canEdit = me.is_admin || me.is_head` — that whole pattern collapses to one `useCanEdit()` call.

### 2. Common changes (every pattern)

In the **panel/wrapper** file:

- Add `import { useCanEdit } from "@/hooks/useCanEdit"` and `const canEdit = useCanEdit()` near the top.
- Delete `const [editMode, setEditMode] = useState(false)`.
- Delete the entire `<Switch label={t("Edit mode")} ...>` or `<Checkbox label={t("Edit mode")} ...>` block.
- Delete the redundant `useSuspenseQuery(trpc.user.me ...)` + `canEdit = me.is_admin || me.is_head` block if the wrapper only used it for the Switch (keep it if `me` is used elsewhere for other purposes).
- Delete the `editingItem ? <EditForm/> : ...` outer branch — the list view is now always rendered; the form renders **inline within the row** (Save/Cancel pattern) or is gone entirely (blur-save).
- Keep `useMutationsStatus` / manual `pending` / `lastError` exactly as they were.

In the **list-view** subcomponent (if any):

- Rename prop `editMode` → `canEdit`.
- Replace `{editMode && <Edit/Delete buttons>}` with the new gated affordances (see pattern sections below).
- Wrap the `{editMode && <Add button>}` block with `{canEdit && ...}` (the "+ Add X" stays in place; it's just always-visible to canEdit users now, no toggle).

### 3a. Save/Cancel pattern (multi-field)

Pass the edit form down via a render prop. In the panel:

```tsx
<ListView
  /* existing props */
  canEdit={canEdit}
  editingId={editingId}
  renderEditForm={item => (
    <ExistingEditForm
      item={item}
      pending={pending}
      onSubmit={handleSave(item)}
      onCancel={() => {
        setEditingId(null)
      }}
      /* drop onDelete from the form — Delete moves to the row's actions slot */
    />
  )}
/>
```

In the list-view, wrap each row in `<InlineEditRow>`:

```tsx
<InlineEditRow
  editing={editingId === item.id}
  canEdit={canEdit}
  pending={pending}
  editLabel={t("Edit <thing> {{name}}", { name: item.name })}
  onStartEdit={() => {
    onEdit(item.id)
  }}
  view={<>{/* the existing read-only row content */}</>}
  form={renderEditForm(item)}
  actions={
    <Button
      variant="tertiary"
      data-color="danger"
      data-size="sm"
      disabled={pending}
      aria-label={t("Delete <thing> {{name}}", { name: item.name })}
      onClick={() => {
        onDelete(item)
      }}
    >
      {t("Delete")}
    </Button>
  }
/>
```

Inside the edit-form component itself: **remove the in-form Delete button** if the row now has a Delete in `actions`. Keep Save + Cancel. (Reference: `ContactEditForm.tsx` kept its in-form Remove because of an old habit — newer migrations move Delete to the row `actions` and drop it from the form to avoid double affordances.) If you choose not to move Delete (panel reasons), say so when handing back.

`"+ Add X"` block: wrap the whole `<Card key="__add">…</Card>` (or equivalent) with `{canEdit && ( ... )}` so it disappears entirely for non-editors.

### 3b. Blur-save pattern (single field)

Replace the inline field display with `<InlineEditField>` and **delete** the separate edit-form component entirely (it had only one field — `InlineEditField` is the replacement).

```tsx
<InlineEditField
  value={String(item.value)}
  canEdit={canEdit}
  pending={pending}
  ariaLabel={t("Edit <thing> for {{label}}", { label })}
  onSave={next => {
    /* parse if numeric; validate; call the existing mutation directly */
    const n = Number(next)
    if (Number.isFinite(n)) onValueSave(item, n)
  }}
/>
```

- Drop `editingId` / `setEditingId` from the panel (the field self-manages).
- Drop the `editingItem ? <EditForm/> : ...` branch — no separate form.
- The existing `update*` mutation is called from the `onSave` callback. No `onSuccess: () => setEditingId(null)` needed.
- Delete the now-unused `*EditForm.tsx` + its `.module.css` (verify with `grep -rln "<NameEditForm" client/src` first).
- Keep the Add flow as-is — it's typically multi-field even when edit is single-field.

### 3c. Affordance-gating only (add-only / remove-only panels)

No `InlineEditField` or `InlineEditRow` needed. Just:

- Drop the Switch + `editMode` state.
- Wrap Add buttons and Remove buttons in `{canEdit && (...)}`.
- Drop any `useEffect` that cleared the add-form state when edit mode toggled off — non-canEdit users can't open the form to begin with.

Reference: Invites.

### 4. i18n

Any new `t("...")` keys you introduce — typically aria-labels like `"Edit <thing> {{name}}"`, `"Delete <thing> {{name}}"`, `"Edit <field> for {{label}}"` — **must** be added to **both** the en and nb files of the namespace the panel uses (the namespace is the argument to `useTranslation(...)` at the top of the wrapper).

Common namespaces:

- `client/src/i18n/locales/{en,nb}/property.json` — used by PropertyContacts, PropertyOwners, Infrastructure, Equipment, ListPropertyStructures
- `client/src/i18n/locales/{en,nb}/usergroups.json` — used by UserGroups, Users, Invites
- `client/src/i18n/locales/{en,nb}/expenses.json` — used by expense panels

Keep keys alphabetically sorted within the existing structure. The natural-key fallback hides missing keys at runtime, so a missing nb entry will silently render English to Norwegian users.

Reuse existing keys when they already convey the action (e.g. `"Remove contact \"{{name}}\"?"` — the trailing `?` is awkward in aria-label but acceptable to reuse and avoid key proliferation; only add a new key if no existing one fits).

**Concurrent agents:** if multiple inline-edit-migrate sub-agents run in parallel, they may collide on the same i18n JSON. If your `Edit` call fails with "file has been modified since read," re-read and retry — that's another agent racing you. The recipe is deterministic enough that retry is safe.

### 5. Verify

```bash
# 1. Typecheck filtered to your changed files. Error count should not increase.
npx tsc -b --pretty false 2>&1 | grep -E "<your-panel-filename>|<your-listview-filename>"
```

Expected residual errors per file: usually one (`t("Error: {{message}}", ...)`) — pre-existing, do not fix.

```bash
# 2. If dev server is running on :5174 (or :5173), confirm Vite transforms the file.
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5174/src/<panel-path>
```

Expect `200`. A non-200 means a syntax or import-resolution error; investigate before reporting done.

If no dev server is running, do not start one — say so in the handback. If sandbox blocks `curl` / `tsc`, say that too; typecheck-passing in your IDE or via the parent is an acceptable substitute.

### 6. Update the inventory

Edit the **Inventory** table at the top of this skill to mark your panel ✅ migrated, with the pattern used and a one-line note about anything surprising. Keeps future invocations honest.

## Behavioural notes preserved from prior migrations

- **Don't disable row expansion across the board.** If the panel had a tap-to-expand affordance (e.g. PropertyContacts showing phone/email), keep it available to all users. Edit button is additive when canEdit, not replacing the tap.
- **Drop the `editingNameId`/`setEditingNameId` patterns from blur-save migrations.** `InlineEditField` owns that state.
- **Add affordance gating: hide, don't disable.** Use `{canEdit && (...)}` around the add button/card, not `disabled={!canEdit}`. The original Switch was hidden for non-editors (`canEdit && <Switch/>`); inline affordances follow suit.
- **Focus restoration is automatic in `InlineEditRow`** (returns focus to its Edit button on cancel/save). Do not add manual focus management.

## Anti-patterns (do not do)

- ❌ Adding `??` instead of `||` for permissions. `me.is_admin || me.is_head` — the hook gets this right; if you re-implement it inline somewhere, use OR.
- ❌ Passing `hideLabel` to Digdir `Textfield` — it doesn't support it. Use `aria-label` (which `InlineEditField` already does internally).
- ❌ "Fixing" the `t("Error: {{message}}", ...)` typecheck error. It's a pre-existing codebase-wide pattern; touching it scope-creeps the migration.
- ❌ Splitting an already-inline edit form into a separate file just because PropertyContacts has one. Inline `const renderEditForm = ...` in the same file is fine and matches Infrastructure/Equipment.
- ❌ Adding optimistic updates, toast notifications, or `aria-live` regions. Out of scope.
- ❌ Renaming or reformatting unrelated code in the file.
- ❌ Migrating an excluded panel without checking with the user first. The 🛑 entries in the inventory are intentional.

## When to stop and ask

- The panel's "edit mode" Switch gates behaviour that **isn't** editing a list (e.g. review/finalize, policy-load, rule-state). This is the settlement/maintenance-style case — check the inventory; if it's 🛑 excluded, skip. If it's a new file not in the inventory, ask the user.
- The edit form has side effects (e.g. nested mutations, conditional category updates like `ListPropertyStructures.handleAddRoom`) that don't fit the `<InlineEditRow>` slot. Hand back with notes.
- You'd need to change the primitive's API to make it fit. Hand back.
- The panel renders a `<table>` instead of `<ul><Card>` rows (like the original `ListUsers`). The recipe assumes the latter; if you decide to rewrite the markup to match (as the Users migration did), say so in the handback — it's a real behavioural change worth a PR bullet.

## Handback report (what to tell the parent)

When done, report:

1. Panel(s) modified (paths).
2. Pattern used (Save/Cancel / blur-save / affordance-gating / mixed).
3. Any files deleted (unused EditForm + CSS).
4. New i18n keys added (en + nb both, with namespace).
5. Typecheck delta: `before → after` total error count, plus a one-liner if any errors in your touched files.
6. Vite serve check result (`200` or skipped + why).
7. Inventory updated: yes / no.
8. Any behavioural changes worth calling out in the PR description (e.g. "Delete button moved out of edit form", "List rewritten from `<table>` to `<Card>` rows").
