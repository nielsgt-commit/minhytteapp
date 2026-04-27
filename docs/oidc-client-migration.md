# Swap the hand-rolled OAuth flow for `oidc-client-ts`

Today: ~80-line manual flow in `client/src/auth/oauth.ts` — auth code,
state-only CSRF, no PKCE, no refresh, sessionStorage by hand.

When you outgrow it (or move off the mock server), swap to
[`oidc-client-ts`](https://github.com/authts/oidc-client-ts). Same shape, fewer
footguns.

## Why bother

- **PKCE by default** — required by most real issuers
- **Silent token refresh** — keeps long sessions alive without re-login
- **Session monitoring** — picks up logout-elsewhere via the issuer's session iframe
- **Robust callback handling** — handles error params, expired state, replay, etc.
- **Storage abstraction** — swap sessionStorage → localStorage → in-memory without rewriting

## Steps

### 1. Install

```bash
npm install oidc-client-ts
```

### 2. Replace `client/src/auth/oauth.ts`

Wrap a single `UserManager` instance:

```ts
import { UserManager, WebStorageStateStore } from "oidc-client-ts"
import type { AuthRouterContext, AuthUser } from "@/routes/__root"

const userManager = new UserManager({
  authority: "http://localhost:8080/default",
  client_id: "hytta-start",
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile",
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
})

let cachedToken: string | null = null
userManager.events.addUserLoaded(u => { cachedToken = u.access_token })
userManager.events.addUserUnloaded(() => { cachedToken = null })

export function getToken(): string | null {
  return cachedToken
}

export async function loadAuth(): Promise<AuthRouterContext> {
  const u = await userManager.getUser()
  if (!u || u.expired) return { isAuthenticated: false, user: null }
  cachedToken = u.access_token
  const user: AuthUser = {
    id: String(u.profile.sub),
    name: String(u.profile.name ?? u.profile.sub),
  }
  return { isAuthenticated: true, user }
}

export function startLogin() { return userManager.signinRedirect() }
export function completeLogin() { return userManager.signinRedirectCallback() }
export function logout() { return userManager.signoutRedirect() }
```

Notes:
- `getToken()` stays sync (reads `cachedToken`), so `client/src/trpc/client.ts` needs no change.
- `loadAuth()` becomes async — see step 3.
- The hand-rolled `STATE_KEY`, `decodeJwtPayload`, etc. all go away — the lib owns this.

### 3. Update `client/src/main.tsx`

`loadAuth()` is now async, so await it before constructing the router. Render
a placeholder during the await:

```tsx
const auth = await loadAuth()
const router = createRouter({ routeTree, context: { auth, queryClient } })
// ...rest unchanged
```

If you don't want top-level await, wrap startup in an async IIFE.

### 4. Update `client/src/routes/auth.callback.tsx`

The lib reads `code`/`state` off the URL itself — drop the `validateSearch`
and the manual args:

```tsx
useEffect(() => {
  completeLogin()
    .then(() => { window.location.replace("/dashboard") })
    .catch((e: unknown) => { setError(e instanceof Error ? e.message : "Login failed") })
}, [])
```

### 5. Wire silent renew (optional but recommended)

`automaticSilentRenew: true` uses a hidden iframe pointed at
`silent_redirect_uri`. Add a static `client/public/silent-renew.html`:

```html
<!doctype html>
<script type="module">
  import { UserManager } from "oidc-client-ts"
  new UserManager({}).signinSilentCallback().catch(console.error)
</script>
```

…and add `silent_redirect_uri: ${origin}/silent-renew.html` to the
`UserManager` config. To exercise it, drop `tokenExpiry` in
`mock-oauth2-server/config.json` from `3600` to `60` and watch the Network tab
for the iframe's `/authorize` hit just before expiry.

### 6. Logout button

Wire `UserMenu`'s no-op `handleAction` to `logout()` from `oauth.ts`. The lib
will redirect to `end_session_endpoint`, then back to
`post_logout_redirect_uri`.

## Validation checklist

- [ ] Hard-refresh `/dashboard` while signed in — stays on dashboard, no bounce to `/`.
- [ ] Open devtools → Application → Session Storage: see `oidc.user:...` keys.
- [ ] Set `tokenExpiry: 60` and idle for 60s — silent renew fires, `getToken()` returns a fresh token.
- [ ] Logout — `oidc.user:...` keys are gone, `_authed/*` redirects back to `/`.
- [ ] tRPC requests still carry `Authorization: Bearer <token>` (Network tab).
