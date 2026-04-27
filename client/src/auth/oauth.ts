import type { AuthRouterContext, AuthUser } from "@/routes/__root"

const ISSUER = "http://localhost:8080/default"
const CLIENT_ID = "hytta-start"
const REDIRECT_URI = `${window.location.origin}/auth/callback`

const TOKEN_KEY = "oauth.access_token"
const USER_KEY = "oauth.user"
const STATE_KEY = "oauth.state"
const PENDING_INVITE_KEY = "oauth.pending_invite"

export function setPendingInvite(token: string): void {
  sessionStorage.setItem(PENDING_INVITE_KEY, token)
}

export function takePendingInvite(): string | null {
  const t = sessionStorage.getItem(PENDING_INVITE_KEY)
  if (t) sessionStorage.removeItem(PENDING_INVITE_KEY)
  return t
}

type TokenResponse = {
  access_token: string
  id_token?: string
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload = ""] = token.split(".")
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  return JSON.parse(atob(normalized)) as Record<string, unknown>
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function loadAuth(): AuthRouterContext {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const userJson = sessionStorage.getItem(USER_KEY)
  if (!token || !userJson) return { isAuthenticated: false, user: null }
  return { isAuthenticated: true, user: JSON.parse(userJson) as AuthUser }
}

export function startLogin(): void {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid",
    state,
  })
  window.location.assign(`${ISSUER}/authorize?${params.toString()}`)
}

export async function completeLogin(code: string, state: string): Promise<void> {
  const expected = sessionStorage.getItem(STATE_KEY)
  if (!expected) {
    if (sessionStorage.getItem(TOKEN_KEY)) return
    throw new Error("OAuth state mismatch")
  }
  if (expected !== state) {
    throw new Error("OAuth state mismatch")
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
  })
  const res = await fetch(`${ISSUER}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status.toString()}`)
  }
  const json = (await res.json()) as TokenResponse
  const claims = decodeJwtPayload(json.id_token ?? json.access_token)
  const sub = typeof claims.sub === "string" ? claims.sub : "unknown"
  const name = typeof claims.name === "string" ? claims.name : sub
  const user: AuthUser = { id: sub, name }
  sessionStorage.setItem(TOKEN_KEY, json.access_token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  sessionStorage.removeItem(STATE_KEY)
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}