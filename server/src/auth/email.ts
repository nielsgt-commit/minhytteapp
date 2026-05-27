export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

// Synthetic emails are generated internally for ghost-user cleanup
// (@oauth.local) and child users (@example.local). They must never satisfy
// the allowlist nor be sent magic links.
const SYNTHETIC_SUFFIXES = ["@oauth.local", "@example.local"]

export function isSyntheticEmail(email: string): boolean {
  const normalized = normalizeEmail(email)
  return SYNTHETIC_SUFFIXES.some(s => normalized.endsWith(s))
}
