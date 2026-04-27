# Property invite links

A token-based flow that lets an admin invite someone to a property without
pre-creating their user row. The invitee signs in (mock-oauth2 today) and the
DB user + `property_owners` row are created on accept.

## Pieces

### DB

`property_invitations` (in `server/src/db/schema/property.schema.ts`):

| column                | notes                                              |
| --------------------- | -------------------------------------------------- |
| `token`               | random 24-byte hex, unique, lives in the URL       |
| `property_id`         | FK → `properties`                                  |
| `email`               | invitee email (also seeds the user row on accept)  |
| `ownership_pct`       | `numeric(5,2)`, applied to the new owner row       |
| `expires_at`          | created with `DEFAULT_TTL_DAYS = 14`               |
| `used_at`             | set on accept                                      |
| `used_by_user_id`     | set on accept                                      |
| `created_by_user_id`  | the admin who minted it                            |
| `created_at`          | `defaultNow()`                                     |

Migration: `drizzle/0009_acoustic_night_thrasher.sql`.

### Server

`server/src/trpc/routers/invite.ts`:

- `list` / `create` / `revoke` — `propertyAdminProcedure`. `revoke` only
  deletes pending invites (`used_at IS NULL`); accepted ones are read-only.
- `peek` — `publicProcedure`. Returns `{ email, property_name, expired, used }`
  by token, so `/invite/$token` can render before the user signs in.
- `accept` — `authenticatedProcedure` (new in `init.ts`). Requires a valid JWT
  but **not** a pre-existing DB user. Inside a tx:
  1. Look up user by `oauth_sub == claims.sub`.
  2. If miss, look up by `email == invite.email` and set `oauth_sub`.
  3. Otherwise insert `{ name: claims.name ?? invite.email, email: claims.email ?? invite.email, oauth_sub: claims.sub, is_admin: false }`.
  4. Insert `property_owners` row (skip if already an owner).
  5. Mark the invite `used_at` / `used_by_user_id`.

### `authenticatedProcedure` vs `protectedProcedure`

Added in `server/src/trpc/init.ts`. Difference:

- `protectedProcedure` requires `ctx.user` (DB row exists).
- `authenticatedProcedure` only requires `ctx.claims` (a valid JWT).

Use `authenticatedProcedure` for endpoints that need to run *before* the user
has a DB row — first-login provisioning, invite acceptance.

`createContext` now exposes `claims` alongside `user`.

### Client

- `client/src/auth/oauth.ts` — `setPendingInvite(token)` / `takePendingInvite()`
  helpers. SessionStorage key `oauth.pending_invite`.
- `client/src/routes/auth.callback.tsx` — after `completeLogin`, reads the
  pending invite token; redirects to `/invite/<token>` if present, else
  `/dashboard`.
- `client/src/routes/invite.$token.tsx` — peek → either prompt sign-in or
  auto-accept → redirect to `/dashboard`. Handles invalid / used / expired.
- `client/src/features/property/invites/PropertyInvitesPanel.tsx` — admin
  panel: create form, list with status, copy-link button, revoke. Mounted in
  `ManageProperty.tsx` under a new `invites` grid area.

## Flow

```
admin                             invitee
─────                             ───────
ManageProperty
  → Create invite (email, %)
    POST /api/trpc/invite.create
    ← { token, ... }
  → Copy invite link
    https://app/invite/<token>

                                  GET /invite/<token>
                                    invite.peek (public)
                                    ← { email, property_name, ... }
                                  click "Sign in to accept"
                                    setPendingInvite(token)
                                    startLogin()
                                  → mock-oauth2 /authorize
                                  ← /auth/callback?code&state
                                    completeLogin(code, state)
                                    takePendingInvite() → token
                                    redirect /invite/<token>
                                  invite.accept (authenticated)
                                    upsert user by oauth_sub | email
                                    insert property_owners
                                    mark invite used
                                    ← { property_id, user_id }
                                  redirect /dashboard
```

## Demo

1. `npm run dev:all` and sign in at `/` as `Owner` (mock-oauth2 form).
2. Manage Property → **Invites** → Create invite → **Copy invite link**.
3. Open the link in an incognito window.
4. Click *Sign in to accept*; type a new `sub` (e.g. `cousin-lars`) in the
   mock-oauth2 form. The invite auto-accepts and lands on `/dashboard` as the
   new user, already an owner.

## Caveats

- The mock JWT only carries `sub` by default. The new user's `name` falls
  back to the invite email. To get better names from the IdP, add `name` /
  `email` to the `claims` block in `mock-oauth2-server/config.json`.
- The mock IdP's session cookie at `localhost:8080` sticks across logins.
  Use incognito (or clear that origin's cookies) to test multi-identity in
  one browser. `logout()` is local-only — see `oidc-client-migration.md`.
- Server **does not verify the JWT signature** — `extractClaims` only base64
  decodes the payload. Fine for the mock, but bake in verification before
  pointing at a real IdP. `extractClaims` is the single chokepoint.
- Tokens are 48 hex chars. Sufficient entropy for a demo; no rate-limit on
  `peek`/`accept`. Add basic abuse protection before production.

## Possible follow-ups

- Email delivery (today the admin copy-pastes the link).
- Invite a `user_group` instead of an individual (mirror the
  `propertyOwner.addGroup` shape).
- Re-send / extend an existing invite instead of creating a new one.
- Show pending invites as "incoming" on the invitee's dashboard if they're
  already signed in but not yet an owner of that property.