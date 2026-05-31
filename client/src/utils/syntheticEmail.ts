// Synthetic emails are generated server-side for users that can't (yet) sign
// in: quick-added stub members (@example.local) and child users
// (@example.local), plus ghost-user cleanup (@oauth.local). They never satisfy
// the auth allowlist and never receive magic links. Mirrors the server-side
// check in server/src/auth/email.ts.
const SYNTHETIC_SUFFIXES = ["@oauth.local", "@example.local"]

export function isSyntheticEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return SYNTHETIC_SUFFIXES.some(s => normalized.endsWith(s))
}
