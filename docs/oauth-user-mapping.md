# Mapping the OAuth identity to a DB user

## Today (mock-server convenience)

The OAuth identity → DB user mapping is keyed on **`oauth_sub`**, but `oauth_sub`
is seeded to equal the user's `name` (`"Owner"`, `"Member"`) so you can type a
short string at the mock server's interactive login form instead of a full
email or opaque ID.

Two places assume this convenience:

1. **Server** — `server/src/trpc/context.ts` does
   `where(eq(usersTable.oauth_sub, claims.sub))`. This is the right shape
   long-term; only the *value* is convenience-flavoured.
2. **Client** — `client/src/components/core/header/UserMenu.tsx` filters
   `trpc.user.list` by `users.name === auth.user.name` to find "me" in the
   list. This is the *wrong shape* long-term — a real opaque sub like
   `8f1a-...-c2` won't match any name.

## When you switch to a real IdP

1. **Backfill `oauth_sub`** with the real subject identifiers from the IdP
   (one-off migration script, or set on first successful login).
2. **Add a `trpc.user.me` query** — `protectedProcedure.query(({ ctx }) => ctx.user)`
   already returns the resolved DB row.
3. **Drop the name-match in `UserMenu.tsx`** — replace the `trpc.user.list`
   fetch + filter with `trpc.user.me`. The `+ Add user` sentinel and Redux
   `selectedUserId` flow stay as they are.
4. **Stop seeding `oauth_sub` to `name`** in `server/src/db/seed.ts` — leave
   it null and let the first-login flow populate it, or seed real test subs.

No server-side auth code needs to change — the lookup is already by
`oauth_sub`, just the values become opaque.
