# App-code invariants

Rules the DB schema can't (or can't cleanly) enforce. Enforce in handlers/services.

## Ownership (`property_owners`)
- Owner (`user_id`) must exist in `family_members` for some family.
- Sum of `ownership_pct` per `property_id` should equal 100.00.

## Family membership (`family_members`)
- `relationship_type` enum: `parent` | `child` | `guest`. Guest = associated, not a full member.
- A user may belong to multiple families (no global uniqueness on `user_id`), but not twice in the same family (enforced by unique `(family_id, user_id)`).

## Adjacencies (`building_adjacencies`, `room_adjacencies`)
- Always insert pairs in sorted order: smaller id first. A CHECK rejects otherwise. This keeps `(1, 2)` and `(2, 1)` from both existing.

## Rooms (`rooms`)
- `room_type` (single/double/family) is independent from bed counts. If you want consistency (e.g. `room_type = 'single'` implies `beds_sm + beds_double ≤ 1`), enforce in app code or add a CHECK later.

## Bookings (`bookings`, `booking_rooms`, `booking_occupants`)
- Booker should also appear in `booking_occupants` (store both at create time).
- Every room in `booking_rooms` must belong to a building whose `property_id` matches the booking's `property_id`.
- Per room and overlapping date window: `SUM(booking_rooms.beds_sm)` ≤ `rooms.beds_sm` (same for `beds_lg`, `beds_double`, `mattresses`). Not expressible as a single CHECK — validate on insert/update.
- Sleeping-spot sanity: `SUM(beds_* + mattresses)` across a booking's rooms should cover `COUNT(booking_occupants)`, unless your house rules allow shared beds (e.g. small children).

## Expenses (`expenses`, `shares`)
- `SUM(shares.share_amount) = expenses.amount` for each expense — but only when the settlement's `split_policy = 'shares'`. For other policies, `shares` may be absent or ignored.
- `booking_id` and `maintenance_id` are both optional and independent — an expense can be tied to a booking, a maintenance task, both (e.g. tap replaced during a booking), or neither (e.g. annual insurance).
- `settlement_id` is nullable — set when an expense is rolled into a settlement. An expense belongs to at most one settlement (scalar FK). Don't attach `settlement_id` until the expense has `status='submitted'`.
- Enforced by CHECK: `status='reimbursed'` implies `reimbursed_by_id IS NOT NULL`. The reverse is not enforced — you can pre-record who *will* reimburse before the status flips.
- Enforced by CHECK: `reimbursed_by_id <> payer_id` (no self-reimbursement). Null-safe: the CHECK evaluates to NULL when `reimbursed_by_id` is null, which Postgres accepts.
- `reimbursed_by_id` is the settlement-time "effective payer". App-code formula: `effective_payer = COALESCE(reimbursed_by_id, payer_id)`. This is what gets attributed to a family when computing `total_paid`.

## Settlements (`settlements`, `settlement_family_totals`, `settlement_transfers`)
- `settlements` is the season/year container. Unique `(year, season)` so there can't be two "summer 2025" settlements.
- Enforced by CHECK: `status='closed'` ⇔ `closed_at IS NOT NULL`.
- `split_policy` is chosen at settlement creation (not at close) so the intent is explicit and auditable. Supported values:
  - `shares` — use per-user `shares` rows for `total_share`.
  - `families_equal` — `total_share[F] = SUM(all amount) / num_participating_families`.
  - `occupancy_days` — `total_share[F] ∝ person-days that family's members occupied via `booking_occupants`.
- Closing a settlement is a transaction the app performs:
  1. For each `expenses` row with `status='submitted'` and no `settlement_id`, attach `settlement_id`. (Or attach on submission — either is fine, as long as you don't attach `rejected` expenses.)
  2. For each expense included, compute `effective_payer = COALESCE(reimbursed_by_id, payer_id)`.
  3. Recompute per-family totals and upsert into `settlement_family_totals`:
     - `total_paid` = SUM of `amount` where `family_of(effective_payer) = F`.
     - `total_share` = computed per the settlement's `split_policy` (see above).
     - `net` = `total_share - total_paid` (positive = family owes, negative = family is owed).
  4. Resolve the net positions into minimal `settlement_transfers` (standard debt-simplification: largest debtor pays largest creditor, repeat).
  5. Reimbursement status flip is **decoupled** from settlement close: `status='reimbursed'` is user-set at the moment of reimbursement (e.g. parent pays kid back), not at settlement close. The settlement just rolls up whatever is in the ledger.
  6. Set `status='closed'` and `closed_at=now()`.
- Enforced by CHECK on `settlement_transfers`: `from_family_id <> to_family_id`, `amount > 0`, and `status='paid'` ⇔ `paid_at` set.
- A user on an expense is attributed to the family from `family_members`. If a user belongs to multiple families (allowed by schema), app code must pick one for settlement attribution (e.g. primary family, or split) — otherwise totals will double-count.
- Expenses with `status='rejected'` should be skipped when computing totals.

## Places (`places`)
- `property_id` is nullable — places can exist unattached and be linked to a property later.

## Maintenance (`maintenance`, `routines`, `maintenance_updates`, `maintenance_attachments`)
- Enforced by CHECK: exactly one of `building_id` / `place_id` is set (XOR).
- Enforced by CHECK: `status = 'done'` ⇔ `completed_at IS NOT NULL`. App code must set `completed_at` when transitioning to done (and clear it if status moves back).
- Enforced by CHECK: `routine_id` and `routine_position` are both set or both null.
- Enforced by CHECK: `recurrence = 'recurring'` ⇔ `recurrence_interval_days IS NOT NULL`.
- `routine_position` uniqueness within a routine is not enforced — app code should assign unique positions (or add a `unique(routine_id, routine_position)` later if you want strict ordering).
- Recurring tasks: after completing, app code should advance `due_at` by `recurrence_interval_days` and reset `status` to `todo` + clear `completed_at`. (Alternative: create a new task row per occurrence and keep the completed one as history — pick one and document.)
- `due_at` is optional for ephemeral tasks (untimed todo) but should always be set for recurring tasks.
- Cost of a maintenance task is derived, not stored: `SUM(expenses.amount WHERE expenses.maintenance_id = task.id)`. No denormalized `cost` column — the expenses ledger is the single source of truth.
- `severity` (major/minor/patch), `status` (todo/doing/done), and `category` are independent; any combination is legal.
- `maintenance_updates` and `maintenance_attachments` cascade on delete of the parent `maintenance` row.