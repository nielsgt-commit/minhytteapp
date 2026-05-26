# Stays and settlement occupancy

## What `stays` is

`stays` is the ad-hoc presence ledger, separate from `bookings`. A stay row is
created when a user toggles the **CheckIn** switch in the header without an
existing booking covering today. Schema lives in
`server/src/db/schema/stay.schema.ts`.

Key columns:

- `user_id`, `property_id` — who is at which property
- `start_date` — date the user toggled on (`CURRENT_DATE` at insert)
- `end_date` — `NULL` while still checked in; set to `CURRENT_DATE` on check-out

Invariants enforced in the DB:

- `end_date IS NULL OR start_date <= end_date` (CHECK)
- Partial unique index on `(user_id, property_id) WHERE end_date IS NULL` —
  a user can only have one open stay per property at a time.

## Why it is separate from `bookings`

A planned `bookings` row requires room + bed allocation (see `allocateRoom` in
`server/src/trpc/routers/booking.ts` and `server/src/INVARIANTS.md`). The
check-in switch is meant to be one click — no room picker, no bed counts. Two
tables, two sets of invariants.

The check-in mutation (`stay.checkIn`) bridges the two:

1. If a non-cancelled booking covers `CURRENT_DATE` for this user/property, set
   it to `confirmed` (idempotent if already confirmed) and do **not** insert a
   stay row.
2. Otherwise, insert an open stay row (`end_date IS NULL`).

Check-out (`stay.checkOut`) only ever closes the open stay — it does not touch
bookings.

## TODO — settlement `occupancy_days` aggregation

The settlement `split_policy = 'occupancy_days'` (see
`server/src/INVARIANTS.md` §Settlements) currently only contemplates
`booking_occupants × bookings` date ranges. When the aggregation is
implemented, it must also count person-days from `stays`:

- Closed stay: `end_date - start_date + 1` days.
- Open stay (`end_date IS NULL`): treat as ongoing.
  - For a settlement that has been opened mid-stay, decide on a cut-off date
    (settlement close date, season end, or `CURRENT_DATE` at compute time) and
    use `min(cutoff, CURRENT_DATE) - start_date + 1`.
  - Open stays should probably be auto-closed when a settlement is finalised —
    figure this out when the aggregation lands.

Total person-days for a user/settlement is the **union** of:

- `bookings × booking_occupants` (clipped to the settlement's date range), and
- `stays` (clipped to the settlement's date range).

Watch for double-counting: if a user has both a `booking_occupants` row and a
`stays` row that overlap (e.g. they checked in *and* were on a planned booking
that got promoted to `confirmed`), the check-in path is supposed to skip
inserting a stay — but the aggregation should still defensively merge
overlapping intervals before summing days.
