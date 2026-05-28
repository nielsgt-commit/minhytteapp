-- Wipes every data row in the connected DB, keeping only one users row
-- (weather@minhytte.app). Safe to run from a SQL console: the whole
-- thing is one transaction, so a missing keep-user or any FK problem
-- rolls back atomically.
--
-- After running, magic-link sign-in for weather@minhytte.app still
-- works: isEmailAllowed() in auth.ts matches against the users row, and
-- better-auth recreates the wiped accounts/sessions rows on first login.
--
-- Run as a single script (select all, execute) — do not run statements
-- one at a time, the BEGIN/COMMIT guards the abort path.

BEGIN;

-- safety: abort the whole transaction if the keep-user isn't here
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'weather@minhytte.app') THEN
    RAISE EXCEPTION 'keep-user weather@minhytte.app not found — aborting';
  END IF;
END $$;

-- wipe every non-users table; CASCADE catches anything missed; RESTART
-- IDENTITY resets sequences so new IDs start at 1.
TRUNCATE TABLE
  shares,
  settlement_user_group_totals,
  settlement_acceptances,
  settlement_booking_adjustments,
  settlement_transfers,
  property_split_policies,
  expenses,
  expense_categories,
  settlements,
  inspections,
  maintenance,
  equipment,
  booking_occupants,
  booking_rooms,
  bookings,
  stays,
  events,
  allowed_emails,
  parking_claims,
  property_priority_weeks,
  property_owners,
  property_contacts,
  infrastructure,
  rooms,
  structures,
  properties,
  user_group_members,
  user_groups,
  sessions,
  accounts,
  verifications
RESTART IDENTITY CASCADE;

-- break self-ref so we can delete parent rows
UPDATE users SET parent_user_id = NULL;

DELETE FROM users WHERE email <> 'weather@minhytte.app';

-- sanity check inside the txn; should print 1
SELECT
  (SELECT count(*) FROM users)    AS users_remaining,
  (SELECT count(*) FROM accounts) AS accounts_remaining,
  (SELECT email FROM users LIMIT 1) AS kept_user_email;

COMMIT;
