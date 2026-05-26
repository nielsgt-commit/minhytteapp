# Auth — design notes

Captured at the point we ripped out the scaffolded `authSlice`. Read this before
wiring real auth so we don't accidentally re-create the Redux duplication.

## Why there is no auth slice

"Who is the currently authenticated user" is **server state** — the server is the
source of truth (session/JWT validation), the client just caches the answer. We
already have a server-state cache: tRPC + TanStack Query. Putting the user in
Redux too creates two sources of truth that drift.

Redux's own current guidance (redux.js.org style guide & FAQ):

> The single most common use case for side effects in a typical Redux app is
> fetching and caching data from the server. We recommend using RTK Query as the
> default approach for data fetching and caching in a Redux app. We recommend
> against writing data fetching logic by hand in almost all cases.

> Don't use Redux until you have problems with vanilla React. — Dan Abramov

Substitute "tRPC + TanStack Query" for "RTK Query" and the same logic applies:
the server-state cache is the right home for the current user.

## Current dev shortcut

`client/src/main.tsx` hardcodes the router context:

```ts
const auth = import.meta.env.DEV
  ? { isAuthenticated: true, user: { id: "demo", name: "Demo User" } }
  : { isAuthenticated: false, user: null }
```

This bypasses the `_authed` route guard during development. Production builds
get `isAuthenticated: false`, so `_authed/*` redirects to `/`. Remove this
shortcut once `trpc.auth.me` exists.

The `AuthRouterContext` / `AuthUser` types live in `client/src/routes/__root.tsx`
(they were the only consumers after the slice was removed).

## When building real auth

### Server

1. **Schema**: extend `usersTable` with `password_hash` (or whatever credential
   shape we pick — passkey, OAuth, etc.) and add a `sessions` table. Generate +
   apply the migration: `npm run db:generate && npm run db:migrate`.
2. **Replace `protectedProcedure`** in `server/src/trpc/init.ts` — it currently
   just checks for an `authorization` header. It needs to verify the session
   token and inject `ctx.user`.
3. **Add `server/src/trpc/routers/auth.ts`** with at minimum:
   - `me` (query) — returns the current user from `ctx.user` (or `null`)
   - `login` (mutation) — takes credentials, returns user + sets session
   - `logout` (mutation) — clears the session
   - optionally `register`
4. **Mount on `_app.ts`**: `auth: authRouter`.

### Client

1. **Replace the dev shortcut in `main.tsx`** with a component that reads
   `trpc.auth.me`:

   ```tsx
   function InnerApp() {
     const trpc = useTRPC()
     const { data: user } = useSuspenseQuery(trpc.auth.me.queryOptions())
     return (
       <RouterProvider
         router={router}
         context={{ auth: { isAuthenticated: user !== null, user }, queryClient }}
       />
     )
   }
   ```

   Prefetch `trpc.auth.me` before render so `useSuspenseQuery` doesn't actually
   suspend the whole app on first paint.

2. **Wire `UserMenu`'s `handleAction`** in
   `client/src/components/core/header/UserMenu.tsx` — currently a no-op. It
   should call `trpc.auth.logout` via `useMutation` and
   `qc.invalidateQueries({ queryKey: trpc.auth.me.queryKey() })` in `onSuccess`.

3. **Build a login route** — `client/src/routes/login.tsx` (or under
   `_marketing`). Form posts via `trpc.auth.login.mutationOptions()`, then
   invalidates `trpc.auth.me` and navigates.

## What WOULD legitimately go in a Redux slice

A slice is the right call when state is:

- Pure client-only UI (login modal open, form draft, transient flags)
- Cross-feature client preferences not persisted server-side
- Genuinely shared and updated frequently from many places

None of those apply to "current authenticated user". Add a slice only when one
of these actually shows up — don't pre-emptively create an `authUiSlice` "for
later".