const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"])

export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}
